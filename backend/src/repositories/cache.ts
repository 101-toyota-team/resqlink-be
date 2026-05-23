import { AmbulanceLocation } from "../types";

export interface ICacheRepository {
  getDriversInBucket(h3Index: string): Promise<string[]>;
  updateDriverLocation(
    driverId: string,
    locationData: AmbulanceLocation,
    h3Index: string,
    ttl: number,
    previousH3Index?: string,
  ): Promise<void>;
  getDriverLocation(driverId: string): Promise<AmbulanceLocation | null>;
  getDriverLocations(
    driverIds: string[],
  ): Promise<(AmbulanceLocation | null)[]>;
  addDriverToBucket(h3Index: string, driverId: string): Promise<void>;
  removeDriverFromBucket(h3Index: string, driverId: string): Promise<void>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
}
