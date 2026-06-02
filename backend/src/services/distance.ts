import { IGenericCache } from "../repositories/generic-cache";
import { IMapsRepository } from "../repositories/maps";
import { AmbulanceLocation } from "../types";
import { IGeoService } from "./geo";
import logger from "../utils/logger";
import { GLOBAL_H3_RESOLUTION, REDIS } from "../utils/constants";
import { decodePolyline } from "../utils/polyline";
import { normalizeCoordinate, calculateViewport } from "../utils/route";

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
  getRouteLeg(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
  ): Promise<{
    distance: number;
    duration: number;
    encoded_polyline: string;
    viewport: {
      low: { lat: number; lng: number };
      high: { lat: number; lng: number };
    };
  }>;
}

export class DistanceService implements IDistanceService {
  constructor(
    private maps: IMapsRepository,
    private cache: IGenericCache,
    private geo: IGeoService,
  ) {}

  async getRouteLeg(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
  ) {
    const cacheKey = `route_leg:${normalizeCoordinate(origin.lat)},${normalizeCoordinate(origin.lng)}:${normalizeCoordinate(dest.lat)},${normalizeCoordinate(dest.lng)}`;

    const cached = await this.cache.get<{
      distance: number;
      duration: number;
      encoded_polyline: string;
      viewport: {
        low: { lat: number; lng: number };
        high: { lat: number; lng: number };
      };
    }>(cacheKey);
    if (cached) return cached;

    const directions = await this.maps.getDirections(
      `${origin.lat},${origin.lng}`,
      `${dest.lat},${dest.lng}`,
    );

    if (directions.status !== "OK" || !directions.routes[0]) {
      throw new Error(`ROUTING_FAILED:${directions.status}`);
    }

    const route = directions.routes[0];
    const encoded = route.overview_polyline.points;
    const points = decodePolyline(encoded);
    const viewport = calculateViewport(points);

    const legData = {
      distance: route.distance || 0,
      duration: route.duration || 0,
      encoded_polyline: encoded,
      viewport: viewport,
    };

    // 7-day TTL (604800 seconds)
    await this.cache.set(cacheKey, legData, 604800);
    return legData;
  }

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
      return `${REDIS.PREFIXES.DIST_CACHE}${dIdx}:${pIdx}`;
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
      uncached.sort((a, b) => {
        const distA = this.geo.haversineDistance(
          a.driver.lat,
          a.driver.lng,
          pickupLatLng.lat,
          pickupLatLng.lng,
        );
        const distB = this.geo.haversineDistance(
          b.driver.lat,
          b.driver.lng,
          pickupLatLng.lat,
          pickupLatLng.lng,
        );
        return distA - distB;
      });

      const topUncached = uncached.slice(0, 15);

      const origins = topUncached.map((r) => `${r.driver.lat},${r.driver.lng}`);
      const matrix = await this.maps.getDistanceMatrix(origins, [
        pickupLocation,
      ]);

      if (matrix.status !== "OK") {
        logger.error(
          "Maps Distance API returned non-OK status: %s",
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
        topUncached.map(async (r, i) => {
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
            const cacheKey = `${REDIS.PREFIXES.DIST_CACHE}${dIdx}:${pIdx}`;
            await this.cache.set(
              cacheKey,
              cacheData,
              REDIS.TTLS.DISTANCE_CACHE,
            );
            r.cached = cacheData;
          }
        }),
      );
      for (const result of writeResults) {
        if (result.status === "rejected") {
          logger.warn("Distance cache write failed:", result.reason);
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
