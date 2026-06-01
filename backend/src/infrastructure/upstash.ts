import { Redis } from "@upstash/redis/cloudflare";
import { IGenericCache } from "../repositories/generic-cache";
import { ICacheRepository } from "../repositories/cache";
import { AmbulanceLocation } from "../types";
import logger from "../utils/logger";
import type { z } from "zod";

function isAmbulanceLocation(v: unknown): v is AmbulanceLocation {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.lat === "number" && typeof o.lng === "number";
}

export class UpstashRedisRepository implements IGenericCache, ICacheRepository {
  private client: Redis;

  constructor(url: string, token: string) {
    this.client = new Redis({ url, token });
  }

  async getDriversInBucket(h3Index: string): Promise<string[]> {
    const now = Date.now();
    const thirtySecondsAgo = now - 30000;
    return await this.client.zrange<string[]>(
      `h3_zone:${h3Index}`,
      thirtySecondsAgo,
      "+inf",
      { byScore: true },
    );
  }

  async updateDriverLocation(
    driverId: string,
    locationData: AmbulanceLocation,
    h3Index: string,
    ttl: number,
    previousH3Index?: string,
  ): Promise<void> {
    const pipeline = this.client.pipeline();
    const now = Date.now();

    pipeline.set(`driver:loc:${driverId}`, locationData, {
      ex: ttl,
    });

    pipeline.zadd(`h3_zone:${h3Index}`, { score: now, member: driverId });

    if (previousH3Index && previousH3Index !== h3Index) {
      pipeline.zrem(`h3_zone:${previousH3Index}`, driverId);
    }

    // Clean up stale drivers in the current bucket
    pipeline.zremrangebyscore(`h3_zone:${h3Index}`, 0, now - 60000); // 1 min grace

    await pipeline.exec();
  }

  async addDriverToBucket(h3Index: string, driverId: string): Promise<void> {
    await this.client.zadd(`h3_zone:${h3Index}`, {
      score: Date.now(),
      member: driverId,
    });
  }

  async removeDriverFromBucket(
    h3Index: string,
    driverId: string,
  ): Promise<void> {
    await this.client.zrem(`h3_zone:${h3Index}`, driverId);
  }

  async getDriverLocation(driverId: string): Promise<AmbulanceLocation | null> {
    const raw = await this.client.get(`driver:loc:${driverId}`);
    if (!isAmbulanceLocation(raw)) {
      if (raw !== null && raw !== undefined) {
        logger.warn(`Corrupt driver location data in Redis for ${driverId}`);
      }
      return null;
    }
    return raw;
  }

  async getDriverLocations(
    driverIds: string[],
  ): Promise<(AmbulanceLocation | null)[]> {
    if (driverIds.length === 0) return [];
    const keys = driverIds.map((id) => `driver:loc:${id}`);
    const results = await this.client.mget<(AmbulanceLocation | null)[]>(keys);
    return results.map((r, i) => {
      if (!isAmbulanceLocation(r)) {
        if (r !== null && r !== undefined) {
          logger.warn(
            `Corrupt driver location data in Redis for ${driverIds[i]}`,
          );
        }
        return null;
      }
      return r;
    });
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, { ex: ttl });
    } else {
      await this.client.set(key, value);
    }
  }

  async get<T>(key: string, schema?: z.ZodType<T>): Promise<T | null> {
    const data = await this.client.get(key);
    if (data === null || data === undefined) return null;
    if (schema) {
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        logger.warn(`Cache data validation failed for key ${key}`);
        return null;
      }
      return parsed.data;
    }
    return data as T;
  }

  async mget<T>(keys: string[], schema?: z.ZodType<T>): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const results = await this.client.mget<(T | null)[]>(keys);
    return results.map((r, i) => {
      if (r === null || r === undefined) return null;
      if (schema) {
        const parsed = schema.safeParse(r);
        if (!parsed.success) {
          logger.warn(`Cache data validation failed for key ${keys[i]}`);
          return null;
        }
        return parsed.data;
      }
      return r as T;
    });
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async lpush<T>(key: string, ...values: T[]): Promise<number> {
    return await this.client.lpush(key, ...values);
  }

  async rpush<T>(key: string, ...values: T[]): Promise<number> {
    return await this.client.rpush(key, ...values);
  }

  async lpop<T>(key: string): Promise<T | null> {
    return await this.client.lpop<T>(key);
  }

  async llen(key: string): Promise<number> {
    return await this.client.llen(key);
  }
}
