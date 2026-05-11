import { ICacheRepository } from "../repositories/cache";
import { IMapsRepository } from "../repositories/maps";
import { DriverLocation } from "../types";
import { IGeoService } from "./geo";
import logger from "../utils/logger";
import { DISTANCE_SERVICE } from "../utils/constants";

export interface IDistanceService {
  getEnrichedDrivers<T extends DriverLocation>(
    drivers: T[],
    pickupLocation: string,
  ): Promise<(T & { eta: string; distance: string })[]>;
}

export class DistanceService implements IDistanceService {
  constructor(
    private maps: IMapsRepository,
    private cache: ICacheRepository,
    private geo: IGeoService,
  ) {}

  async getEnrichedDrivers<T extends DriverLocation>(
    drivers: T[],
    pickupLocation: string,
  ): Promise<(T & { eta: string; distance: string })[]> {
    if (drivers.length === 0) return [];

    const pickupLatLng = this.geo.parseLatLng(pickupLocation);
    const pIdx = this.geo.latLngToCell(
      pickupLatLng.lat,
      pickupLatLng.lng,
      DISTANCE_SERVICE.H3_RESOLUTION,
    );

    const resultsWithCache = await Promise.all(
      drivers.map(async (d) => {
        const dIdx = this.geo.latLngToCell(
          d.lat,
          d.lng,
          DISTANCE_SERVICE.H3_RESOLUTION,
        );
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

      if (matrix.status !== "OK") {
        logger.warn(
          "Google Maps Distance API returned non-OK status: %s",
          matrix.status,
        );
        return resultsWithCache.map((r) => ({
          ...r.driver,
          eta: r.cached.eta || "Unknown",
          distance: r.cached.distance || "Unknown",
        }));
      }

      await Promise.all(
        uncached.map(async (r, i) => {
          const element = matrix.rows[i].elements[0];
          if (element.status === "OK") {
            const cacheData = {
              eta: element.duration.text,
              distance: element.distance.text,
            };
            const dIdx = this.geo.latLngToCell(
              r.driver.lat,
              r.driver.lng,
              DISTANCE_SERVICE.H3_RESOLUTION,
            );
            const cacheKey = `dist_cache:${dIdx}:${pIdx}`;
            await this.cache.set(
              cacheKey,
              cacheData,
              DISTANCE_SERVICE.CACHE_TTL_SECONDS,
            );
            r.cached = cacheData;
          }
        }),
      );
    }

    return resultsWithCache.map((r) => ({
      ...r.driver,
      eta: r.cached.eta || "Unknown",
      distance: r.cached.distance || "Unknown",
    }));
  }
}
