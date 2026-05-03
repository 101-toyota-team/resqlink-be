import { ICacheRepository } from "../repositories/cache";
import { DriverDetails, DriverLocation } from "../types";
import { IGeoService } from "./geo";
import { IDistanceService } from "./distance";

export interface IDispatchService {
  findNearbyDrivers(
    h3Index: string,
    radius?: number,
    pickupLocation?: string
  ): Promise<DriverDetails[]>;
  updateDriverStatus(
    driverId: string,
    locationData: DriverLocation,
    h3Index: string,
    previousH3Index?: string
  ): Promise<void>;
}

export class DispatchService implements IDispatchService {
  constructor(
    private cache: ICacheRepository,
    private geo: IGeoService,
    private distance: IDistanceService
  ) {}

  async findNearbyDrivers(
    h3Index: string,
    radius: number = 1,
    pickupLocation?: string
  ): Promise<DriverDetails[]> {
    const neighbors = this.geo.getNeighbors(h3Index, radius);

    const driverIdSets = await Promise.all(
      neighbors.map((idx) => this.cache.getDriversInBucket(idx))
    );

    const driverIds = [...new Set(driverIdSets.flat())];

    const drivers = await this.cache.getDriverLocations(driverIds);

    const driversWithIds = drivers
      .map((d, i) => (d ? { ...d, id: driverIds[i] } : null))
      .filter((d): d is DriverDetails => d !== null);

    if (pickupLocation && driversWithIds.length > 0) {
      const limitedDrivers = driversWithIds.slice(0, 10);
      return await this.distance.getEnrichedDrivers(limitedDrivers, pickupLocation);
    }

    return driversWithIds;
  }

  async updateDriverStatus(
    driverId: string,
    locationData: DriverLocation,
    h3Index: string,
    previousH3Index?: string
  ): Promise<void> {
    // 15s TTL as per requirements
    await this.cache.updateDriverLocation(
      driverId,
      locationData,
      h3Index,
      15,
      previousH3Index
    );
  }
}
