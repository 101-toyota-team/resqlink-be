import { ICacheRepository } from "../repositories/cache";
import { IMapsRepository } from "../repositories/maps";
import { AmbulanceLocation } from "../types";
import { IGeoService } from "./geo";
import logger from "../utils/logger";
import { DISTANCE_SERVICE, GLOBAL_H3_RESOLUTION } from "../utils/constants";

export interface IDistanceService {
  getEnrichedDrivers<T extends AmbulanceLocation>(
    drivers: T[],
    pickupLocation: string,
  ): Promise<
    (T & {
      eta: string;
      distance: string;
      eta_value: number | undefined;
      distance_value: number | undefined;
    })[]
  >;
}

export class DistanceService implements IDistanceService {
  constructor(
    private maps: IMapsRepository,
    private cache: ICacheRepository,
    private geo: IGeoService,
  ) {}

  async getEnrichedDrivers<T extends AmbulanceLocation>(
    drivers: T[],
    pickupLocation: string,
  ): Promise<
    (T & {
      eta: string;
      distance: string;
      eta_value: number | undefined;
      distance_value: number | undefined;
    })[]
  > {
    if (drivers.length === 0) return [];

    const pickupLatLng = this.geo.parseLatLng(pickupLocation);
    const pIdx = this.geo.latLngToCell(
      pickupLatLng.lat,
      pickupLatLng.lng,
      GLOBAL_H3_RESOLUTION,
    );

    const keys = drivers.map((d) => {
      const dIdx = this.geo.latLngToCell(d.lat, d.lng, GLOBAL_H3_RESOLUTION);
      return `dist_cache:${dIdx}:${pIdx}`;
    });

    const cachedResults = await this.cache.mget<{
      eta: string;
      distance: string;
      eta_value: number;
      distance_value: number;
    }>(keys);

    const resultsWithCache = drivers.map((d, i) => ({
      driver: d,
      cached: cachedResults[i],
    }));

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
          eta: r.cached?.eta || "Unknown",
          distance: r.cached?.distance || "Unknown",
          eta_value: r.cached?.eta_value ?? undefined,
          distance_value: r.cached?.distance_value ?? undefined,
        }));
      }

      const writeResults = await Promise.allSettled(
        uncached.map(async (r, i) => {
          const element = matrix.rows[i]?.elements?.[0];
          if (element?.status === "OK") {
            const cacheData = {
              eta: element.duration.text,
              distance: element.distance.text,
              eta_value: element.duration.value,
              distance_value: element.distance.value,
            };
            const dIdx = this.geo.latLngToCell(
              r.driver.lat,
              r.driver.lng,
              GLOBAL_H3_RESOLUTION,
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
      for (const result of writeResults) {
        if (result.status === "rejected") {
          logger.warn("Distance cache write failed: %s", result.reason);
        }
      }
    }

    return resultsWithCache.map((r) => ({
      ...r.driver,
      eta: r.cached?.eta || "Unknown",
      distance: r.cached?.distance || "Unknown",
      eta_value: r.cached?.eta_value ?? undefined,
      distance_value: r.cached?.distance_value ?? undefined,
    }));
  }
}
