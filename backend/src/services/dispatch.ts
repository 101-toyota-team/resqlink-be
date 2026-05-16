import { ICacheRepository } from "../repositories/cache";
import { IPersistenceRepository } from "../repositories/db";
import { DriverDetails, DriverLocation, Booking } from "../types";
import { IGeoService } from "./geo";
import { IDistanceService } from "./distance";
import { IMapsRepository } from "../repositories/maps";
import logger from "../utils/logger";

export interface IDispatchService {
  findNearbyDrivers(
    h3Index: string,
    radius?: number,
    pickupLocation?: string,
  ): Promise<DriverDetails[]>;
  updateDriverStatus(
    driverId: string,
    locationData: DriverLocation,
    h3Index: string,
    previousH3Index?: string,
  ): Promise<void>;
  startSimulation(booking: Booking): Promise<void>;
  advanceSimulation(driverId: string): Promise<void>;
  startSimulationForBooking(booking: Booking, driverId: string): Promise<void>;
}

export class DispatchService implements IDispatchService {
  constructor(
    private cache: ICacheRepository,
    private db: IPersistenceRepository,
    private geo: IGeoService,
    private distance: IDistanceService,
    private maps: IMapsRepository,
  ) {}

  async findNearbyDrivers(
    h3Index: string,
    radius: number = 1,
    pickupLocation?: string,
  ): Promise<DriverDetails[]> {
    const neighbors = this.geo.getNeighbors(h3Index, radius);

    const drivers = await this.db.findAvailableAmbulances(neighbors);

    if (drivers.length === 0) {
      return [];
    }

    if (pickupLocation && drivers.length > 0) {
      const limitedDrivers = drivers.slice(0, 10);
      return await this.distance.getEnrichedDrivers(
        limitedDrivers,
        pickupLocation,
      );
    }

    return drivers;
  }

  async updateDriverStatus(
    driverId: string,
    _locationData: DriverLocation,
    _h3Index: string,
    _previousH3Index?: string,
  ): Promise<void> {
    // For Actual Flow simulation, /ping triggers the next step
    await this.advanceSimulation(driverId);
  }

  async startSimulation(booking: Booking): Promise<void> {
    try {
      const providerLoc = await this.db.getAmbulanceProviderLocation(
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
        return;
      }

      const encodedPolyline = directions.routes[0].overview_polyline
        .points as string;
      const points = this.decodePolyline(encodedPolyline);

      if (points.length === 0) {
        logger.error("Decoded polyline for booking %s is empty", booking.id);
        return;
      }

      // Store in Redis
      await this.cache.set(`sim:route:${booking.id}`, points, 3600);
      await this.cache.set(`sim:step:${booking.id}`, 0, 3600);
    } catch (error) {
      logger.error(error, "Error starting simulation");
    }
  }

  async advanceSimulation(driverId: string): Promise<void> {
    try {
      // 1. Find the active booking for this driver
      const bookingId = await this.cache.get<string>(`sim:active:${driverId}`);
      if (!bookingId) return;

      // 2. Get route and current step
      const route = await this.cache.get<{ lat: number; lng: number }[]>(
        `sim:route:${bookingId}`,
      );
      const step = await this.cache.get<number>(`sim:step:${bookingId}`);

      if (!route || step === null || step >= route.length) {
        // Simulation finished or not found
        if (step !== null && route && step >= route.length) {
          await this.db.updateBookingStatus(bookingId, "arrived");
        }
        return;
      }

      // 3. Get next coordinate
      const nextCoord = route[step];

      // 4. Broadcast
      await this.db.broadcastTripLocation(bookingId, {
        lat: nextCoord.lat,
        lng: nextCoord.lng,
      });

      // 5. Update step
      await this.cache.set(`sim:step:${bookingId}`, step + 1, 3600);

      // 6. Check if arrived
      if (step + 1 >= route.length) {
        await this.db.updateBookingStatus(bookingId, "arrived");
      }
    } catch (error) {
      logger.error(error, "Error advancing simulation");
    }
  }

  async startSimulationForBooking(
    booking: Booking,
    driverId: string,
  ): Promise<void> {
    await this.cache.set(`sim:active:${driverId}`, booking.id, 3600);
    await this.startSimulation(booking);
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

        // Basic coordinate validation
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
