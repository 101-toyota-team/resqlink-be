import { IGenericCache } from "../repositories/generic-cache";
import { IBookingRepository } from "../repositories/booking";
import { IAmbulanceRepository } from "../repositories/ambulance";
import { IRealtimeBroadcaster } from "../repositories/realtime";
import { Booking } from "../types";
import logger from "../utils/logger";
import { decodePolyline } from "../utils/polyline";
import { REDIS } from "../utils/constants";

export interface ISimulationService {
  startSimulation(booking: Booking): Promise<boolean>;
  advanceSimulation(bookingId: string, steps?: number): Promise<void>;
  startSimulationForBooking(booking: Booking): Promise<boolean>;
  stopSimulation(bookingId: string): Promise<void>;
}

export class SimulationService implements ISimulationService {
  constructor(
    private cache: IGenericCache,
    private bookingRepo: IBookingRepository,
    private ambulanceRepo: IAmbulanceRepository,
    private realtime: IRealtimeBroadcaster,
  ) {}

  async startSimulation(booking: Booking): Promise<boolean> {
    if (!booking.ambulance_id) {
      logger.error("Cannot start simulation: no ambulance assigned");
      return false;
    }

    if (
      !booking.route_geometry ||
      !booking.route_geometry.legs ||
      booking.route_geometry.legs.length === 0
    ) {
      logger.error(
        "Cannot start simulation: no route_geometry found for booking:",
        booking.id,
      );
      return false;
    }

    const points: { lat: number; lng: number }[] = [];
    for (const leg of booking.route_geometry.legs) {
      points.push(...decodePolyline(leg.encoded_polyline));
    }

    if (points.length === 0) {
      logger.error("Decoded polyline for booking is empty:", booking.id);
      return false;
    }

    await this.cache.rpush(
      `${REDIS.PREFIXES.SIM_ROUTE}${booking.id}`,
      ...points,
    );
    await this.cache.expire(
      `${REDIS.PREFIXES.SIM_ROUTE}${booking.id}`,
      REDIS.TTLS.SIMULATION,
    );
    return true;
  }

  async advanceSimulation(bookingId: string, steps: number = 1): Promise<void> {
    const booking = await this.bookingRepo.getBooking(bookingId);
    if (!booking) {
      await this.cleanupSimulation(bookingId);
      return;
    }

    if (
      booking.status === "arrived" ||
      booking.status === "to_hospital" ||
      booking.status === "completed" ||
      booking.status === "cancelled"
    ) {
      await this.cleanupSimulation(bookingId);
      return;
    }

    let nextCoord: { lat: number; lng: number } | null = null;
    for (let i = 0; i < steps; i++) {
      const coord = await this.cache.lpop<{ lat: number; lng: number }>(
        `${REDIS.PREFIXES.SIM_ROUTE}${bookingId}`,
      );
      if (coord) {
        nextCoord = coord;
      } else {
        break;
      }
    }

    if (!nextCoord) {
      await this.bookingRepo.updateBookingStatus(bookingId, "arrived");
      await this.cleanupSimulation(bookingId);
      return;
    }

    await this.realtime.broadcastTripLocation(bookingId, {
      lat: nextCoord.lat,
      lng: nextCoord.lng,
    });

    await this.cache.expire(
      `${REDIS.PREFIXES.SIM_ROUTE}${bookingId}`,
      REDIS.TTLS.SIMULATION,
    );

    const remaining = await this.cache.llen(
      `${REDIS.PREFIXES.SIM_ROUTE}${bookingId}`,
    );
    if (remaining === 0) {
      await this.bookingRepo.updateBookingStatus(bookingId, "arrived");
      await this.cleanupSimulation(bookingId);
    }
  }

  async startSimulationForBooking(booking: Booking): Promise<boolean> {
    const ok = await this.startSimulation(booking);
    if (!ok) return false;
    return true;
  }

  async stopSimulation(bookingId: string): Promise<void> {
    await this.cleanupSimulation(bookingId);
  }

  private async cleanupSimulation(bookingId: string): Promise<void> {
    await this.cache.del(`${REDIS.PREFIXES.SIM_ROUTE}${bookingId}`);
  }
}
