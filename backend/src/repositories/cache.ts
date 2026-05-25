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
}
