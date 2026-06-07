import { Booking, DriverLocation } from "../types";
import type { ILogger } from "../types";

export interface IDriverService {
  updateLocation(
    driverId: string,
    payload: {
      lat: number;
      lng: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
      booking_id?: string;
    },
    waitUntil?: (promise: Promise<any>) => void,
  ): Promise<void>;
  getAssignments(driverId: string): Promise<Booking[]>;
  setOnlineStatus(driverId: string, online: boolean): Promise<void>;
}

export class DriverService implements IDriverService {
  constructor(
    private driverRepo: import("../repositories/driver").IDriverRepository,
    private driverLocationRepo: import("../repositories/driver-location").IDriverLocationRepository,
    private bookingRepo: import("../repositories/booking").IBookingRepository,
    private realtime: import("../repositories/realtime").IRealtimeBroadcaster,
    private logger: ILogger,
  ) {}

  async updateLocation(
    driverId: string,
    payload: {
      lat: number;
      lng: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
      booking_id?: string;
    },
    waitUntil?: (promise: Promise<any>) => void,
  ): Promise<void> {
    const location: DriverLocation = {
      lat: payload.lat,
      lng: payload.lng,
      heading: payload.heading,
      speed: payload.speed,
      accuracy: payload.accuracy,
      captured_at: new Date().toISOString(),
      booking_id: payload.booking_id,
    };

    await this.driverLocationRepo.updateLatest(driverId, location);

    if (payload.booking_id) {
      const broadcastPromise = this.realtime
        .broadcastTripLocation(payload.booking_id, location)
        .catch(() => {});

      if (waitUntil) {
        waitUntil(broadcastPromise);
      } else {
        await broadcastPromise;
      }
    }
  }

  async getAssignments(driverId: string): Promise<Booking[]> {
    return this.bookingRepo.getDriverAssignments(driverId);
  }

  async setOnlineStatus(driverId: string, online: boolean): Promise<void> {
    await this.driverRepo.updateAvailability(driverId, online);
  }
}
