export interface ICacheRepository {
  getDriversInBucket(h3Index: string): Promise<string[]>;
  updateDriverLocation(driverId: string, locationData: any, h3Index: string, ttl: number): Promise<void>;
  getDriverLocation(driverId: string): Promise<any | null>;
  addDriverToBucket(h3Index: string, driverId: string): Promise<void>;
  removeDriverFromBucket(h3Index: string, driverId: string): Promise<void>;
}
