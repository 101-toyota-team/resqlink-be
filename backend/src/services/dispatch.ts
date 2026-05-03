import * as h3 from "h3-js";
import { ICacheRepository } from "../repositories/cache";
import { GoogleMapsRepository } from "../infrastructure/google-maps";
import { DriverDetails, DriverLocation } from "../types";

export class DispatchService {
  constructor(
    private cache: ICacheRepository,
    private maps: GoogleMapsRepository,
  ) {}

  async findNearbyDrivers(
    h3Index: string,
    radius: number = 1,
    pickupLocation?: string,
  ): Promise<DriverDetails[]> {
    // Find neighbors (Ring radius)
    const neighbors = h3.gridDisk(h3Index, radius);

    // Fetch driver IDs from all relevant H3 buckets in parallel
    const driverIdSets = await Promise.all(
      neighbors.map((idx) => this.cache.getDriversInBucket(idx)),
    );

    const driverIds = [...new Set(driverIdSets.flat())];

    // Fetch actual locations and details for these drivers in a single MGET call
    const drivers = await this.cache.getDriverLocations(driverIds);

    // Map drivers back to their IDs
    const driversWithIds = drivers
      .map((d, i) => (d ? { ...d, id: driverIds[i] } : null))
      .filter((d): d is DriverDetails => d !== null);

    if (pickupLocation && driversWithIds.length > 0) {
      // Limit to top 10 for Google Maps Rate Limit protection
      const limitedDrivers = driversWithIds.slice(0, 10);

      // 1. Try to get from cache first
      const pickupLatLng = pickupLocation.split(",").map(Number);
      const pIdx = h3.latLngToCell(pickupLatLng[0], pickupLatLng[1], 10);

      const resultsWithCache = await Promise.all(
        limitedDrivers.map(async (d) => {
          const dIdx = h3.latLngToCell(d.lat, d.lng, 10);
          const cacheKey = `dist_cache:${dIdx}:${pIdx}`;
          const cached = await this.cache.get<{ eta: string; distance: string }>(
            cacheKey,
          );
          return { driver: d, cached };
        }),
      );

      const uncached = resultsWithCache.filter((r) => !r.cached);

      if (uncached.length > 0) {
        const origins = uncached.map((r) => `${r.driver.lat},${r.driver.lng}`);
        const matrix = await this.maps.getDistanceMatrix(origins, [
          pickupLocation,
        ]);

        await Promise.all(
          uncached.map(async (r, i) => {
            const element = matrix.rows[i].elements[0];
            if (element.status === "OK") {
              const cacheData = {
                eta: element.duration.text,
                distance: element.distance.text,
              };
              const dIdx = h3.latLngToCell(r.driver.lat, r.driver.lng, 10);
              const cacheKey = `dist_cache:${dIdx}:${pIdx}`;
              // Cache for 5 minutes
              await this.cache.set(cacheKey, cacheData, 300);
              r.cached = cacheData;
            }
          }),
        );
      }

      return resultsWithCache.map((r) => ({
        ...r.driver,
        eta: r.cached?.eta || "Unknown",
        distance: r.cached?.distance || "Unknown",
      }));
    }

    return driversWithIds;
  }

  async updateDriverStatus(
    driverId: string,
    locationData: DriverLocation,
    h3Index: string,
    previousH3Index?: string,
  ): Promise<void> {
    // 15s TTL as per requirements
    await this.cache.updateDriverLocation(
      driverId,
      locationData,
      h3Index,
      15,
      previousH3Index,
    );
  }
}
