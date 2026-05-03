import { DriverLocation } from "../types";

export interface ICacheRepository {
  getDriversInBucket(h3Index: string): Promise<string[]>;
  updateDriverLocation(
    driverId: string,
    locationData: DriverLocation,
    h3Index: string,
    ttl: number,
    previousH3Index?: string,
  ): Promise<void>;
  getDriverLocation(driverId: string): Promise<DriverLocation | null>;
  getDriverLocations(driverIds: string[]): Promise<DriverLocation[]>;
  addDriverToBucket(h3Index: string, driverId: string): Promise<void>;
  removeDriverFromBucket(h3Index: string, driverId: string): Promise<void>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
}
