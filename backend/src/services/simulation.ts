import { ICacheRepository } from "../repositories/cache";
import { IBookingRepository } from "../repositories/booking";
import { IAmbulanceRepository } from "../repositories/ambulance";
import { IRealtimeBroadcaster } from "../repositories/realtime";
import { IMapsRepository } from "../repositories/maps";
import { Booking } from "../types";
import logger from "../utils/logger";

export interface ISimulationService {
  startSimulation(booking: Booking): Promise<boolean>;
  advanceSimulation(driverId: string): Promise<void>;
  startSimulationForBooking(
    booking: Booking,
    driverId: string,
  ): Promise<boolean>;
}

export class SimulationService implements ISimulationService {
  constructor(
    private cache: ICacheRepository,
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

    const providerLoc = await this.ambulanceRepo.getAmbulanceProviderLocation(
      booking.ambulance_id,
    );

    const origin = providerLoc
      ? `${providerLoc.lat},${providerLoc.lng}`
      : `${booking.pickup_lat},${booking.pickup_lng}`;

    const directions = await this.maps.getDirections(
      origin,
      `${booking.pickup_lat},${booking.pickup_lng}`,
    );

    if (directions.status !== "OK" || !directions.routes[0]) {
      logger.error(
        "Directions API failed for simulation: %s",
        directions.status,
      );
      return false;
    }

    const encodedPolyline = directions.routes[0].overview_polyline.points;
    const points = this.decodePolyline(encodedPolyline);

    if (points.length === 0) {
      logger.error(booking.id, "Decoded polyline for booking is empty");
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
      await this.cleanupSimulation(driverId, bookingId);
      return;
    }

    if (
      booking.status === "arrived" ||
      booking.status === "to_hospital" ||
      booking.status === "completed" ||
      booking.status === "cancelled"
    ) {
      await this.cleanupSimulation(driverId, bookingId);
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
    return true;
  }

  private async cleanupSimulation(
    driverId: string,
    bookingId: string,
  ): Promise<void> {
    await this.cache.del(`sim:active:${driverId}`);
    await this.cache.del(`sim:route:${bookingId}`);
    await this.cache.del(`sim:step:${bookingId}`);
  }

  private decodePolyline(encoded: string): { lat: number; lng: number }[] {
    const points: { lat: number; lng: number }[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    try {
      while (index < len) {
        let b;
        let shift = 0;
        let result = 0;
        do {
          if (index >= len) break;
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;
        do {
          if (index >= len) break;
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        const pLat = lat / 1e5;
        const pLng = lng / 1e5;

        if (
          !isNaN(pLat) &&
          !isNaN(pLng) &&
          pLat >= -90 &&
          pLat <= 90 &&
          pLng >= -180 &&
          pLng <= 180
        ) {
          points.push({ lat: pLat, lng: pLng });
        }
      }
    } catch (error) {
      logger.error(error, "Error decoding polyline");
    }
    return points;
  }
}
