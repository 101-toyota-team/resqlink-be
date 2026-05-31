import { IGenericCache } from "../repositories/generic-cache";
import { ICacheRepository } from "../repositories/cache";
import { IBookingRepository } from "../repositories/booking";
import { IAmbulanceRepository } from "../repositories/ambulance";
import { IRealtimeBroadcaster } from "../repositories/realtime";
import { IMapsRepository } from "../repositories/maps";
import { Booking } from "../types";
import logger from "../utils/logger";
import { decodePolyline } from "../utils/polyline";

export interface ISimulationService {
  startSimulation(booking: Booking): Promise<boolean>;
  advanceSimulation(driverId: string): Promise<void>;
  startSimulationForBooking(
    booking: Booking,
    driverId: string,
  ): Promise<boolean>;
  stopSimulation(bookingId: string): Promise<void>;
}

export class SimulationService implements ISimulationService {
  constructor(
    private cache: IGenericCache & ICacheRepository,
    private bookingRepo: IBookingRepository,
    private ambulanceRepo: IAmbulanceRepository,
    private realtime: IRealtimeBroadcaster,
    private maps: IMapsRepository,
  ) {}

  async startSimulation(booking: Booking): Promise<boolean> {
    if (!booking.ambulance_id) {
      logger.error("Cannot start simulation: no ambulance assigned");
      return false;
    }

    let origin: string | null = null;

    if (booking.driver_id) {
      const driverLoc = await this.cache.getDriverLocation(booking.driver_id);
      if (driverLoc) {
        origin = `${driverLoc.lat},${driverLoc.lng}`;
      }
    }

    if (!origin) {
      const providerLoc = await this.ambulanceRepo.getAmbulanceProviderLocation(
        booking.ambulance_id,
      );
      origin = providerLoc
        ? `${providerLoc.lat},${providerLoc.lng}`
        : `${booking.pickup_lat},${booking.pickup_lng}`;
    }

    const directions = await this.maps.getDirections(
      origin,
      `${booking.pickup_lat},${booking.pickup_lng}`,
    );

    if (directions.status !== "OK" || !directions.routes[0]) {
      logger.error("Directions API failed for simulation:", directions.status);
      return false;
    }

    const encodedPolyline = directions.routes[0].overview_polyline.points;
    const points = decodePolyline(encodedPolyline);

    if (points.length === 0) {
      logger.error("Decoded polyline for booking is empty:", booking.id);
      return false;
    }

    await this.cache.set(`sim:route:${booking.id}`, points, 3600);
    await this.cache.set(`sim:step:${booking.id}`, 0, 3600);
    return true;
  }

  async advanceSimulation(driverId: string): Promise<void> {
    const bookingId = await this.cache.get<string>(`sim:active:${driverId}`);
    if (!bookingId) return;

    const booking = await this.bookingRepo.getBooking(bookingId);
    if (!booking) {
      await this.cleanupSimulation(bookingId, driverId);
      return;
    }

    if (
      booking.status === "arrived" ||
      booking.status === "to_hospital" ||
      booking.status === "completed" ||
      booking.status === "cancelled"
    ) {
      await this.cleanupSimulation(bookingId, driverId);
      return;
    }

    const route = await this.cache.get<{ lat: number; lng: number }[]>(
      `sim:route:${bookingId}`,
    );
    const step = await this.cache.get<number>(`sim:step:${bookingId}`);

    if (!route || step === null || step >= route.length) {
      if (step !== null && route && step >= route.length) {
        await this.bookingRepo.updateBookingStatus(bookingId, "arrived");
        await this.cleanupSimulation(driverId, bookingId);
      }
      return;
    }

    const nextCoord = route[step];

    await this.realtime.broadcastTripLocation(bookingId, {
      lat: nextCoord.lat,
      lng: nextCoord.lng,
    });

    await this.cache.set(`sim:step:${bookingId}`, step + 1, 3600);
    await this.cache.expire(`sim:route:${bookingId}`, 3600);
    await this.cache.expire(`sim:active:${driverId}`, 3600);
    await this.cache.expire(`sim:booking_driver:${bookingId}`, 3600);

    if (step + 1 >= route.length) {
      await this.bookingRepo.updateBookingStatus(bookingId, "arrived");
      await this.cleanupSimulation(driverId, bookingId);
    }
  }

  async startSimulationForBooking(
    booking: Booking,
    driverId: string,
  ): Promise<boolean> {
    const ok = await this.startSimulation(booking);
    if (!ok) return false;
    await this.cache.set(`sim:active:${driverId}`, booking.id, 3600);
    await this.cache.set(`sim:booking_driver:${booking.id}`, driverId, 3600);
    return true;
  }

  async stopSimulation(bookingId: string): Promise<void> {
    await this.cleanupSimulation(bookingId);
  }

  private async cleanupSimulation(
    bookingId: string,
    driverIdFallback?: string,
  ): Promise<void> {
    let driverId = driverIdFallback;
    if (!driverId) {
      driverId =
        (await this.cache.get<string>(`sim:booking_driver:${bookingId}`)) ||
        undefined;
    }

    if (driverId) {
      await this.cache.del(`sim:active:${driverId}`);
    }

    await this.cache.del(`sim:booking_driver:${bookingId}`);
    await this.cache.del(`sim:route:${bookingId}`);
    await this.cache.del(`sim:step:${bookingId}`);
  }
}
