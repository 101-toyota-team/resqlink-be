import { DriverLocation } from "../types";

export interface IDriverLocationRepository {
  updateLatest(driverId: string, location: DriverLocation): Promise<void>;
  getLatest(driverId: string): Promise<DriverLocation | null>;
  getLatestBatch(driverIds: string[]): Promise<(DriverLocation | null)[]>;
  flushBatch(): Promise<void>;
  getTripHistory(bookingId: string, limit?: number): Promise<DriverLocation[]>;
}
