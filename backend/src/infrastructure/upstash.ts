import { Redis } from "@upstash/redis/cloudflare";
import { ICacheRepository } from "../repositories/cache";
import { DriverLocation } from "../types";

export class UpstashRedisRepository implements ICacheRepository {
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
      { byScore: true }
    );
  }

  async updateDriverLocation(
    driverId: string,
    locationData: DriverLocation,
    h3Index: string,
    ttl: number,
    previousH3Index: string
  ): Promise<void> {
    const pipeline = this.client.pipeline();
    const now = Date.now();

    pipeline.set(`driver:loc:${driverId}`, JSON.stringify(locationData), {
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
    driverId: string
  ): Promise<void> {
    await this.client.zrem(`h3_zone:${h3Index}`, driverId);
  }

  async updateDriverLocation(
    driverId: string,
    locationData: DriverLocation,
    h3Index: string,
    ttl: number,
    previousH3Index: string,
  ): Promise<void> {
    const pipeline = this.client.pipeline();
    pipeline.set(`driver:loc:${driverId}`, JSON.stringify(locationData), {
      ex: ttl,
    });
    pipeline.sadd(`h3_zone:${h3Index}`, driverId);

    if (previousH3Index && previousH3Index !== h3Index) {
      pipeline.srem(`h3_zone:${previousH3Index}`, driverId);
    }

    await pipeline.exec();
  }

  async getDriverLocation(driverId: string): Promise<DriverLocation | null> {
    return await this.client.get(`driver:loc:${driverId}`);
  }

  async getDriverLocations(driverIds: string[]): Promise<DriverLocation[]> {
    if (driverIds.length === 0) return [];
    const keys = driverIds.map((id) => `driver:loc:${id}`);
    const results = await this.client.mget<DriverLocation[]>(...keys);
    return results.filter((d): d is DriverLocation => d !== null);
  }

  async addDriverToBucket(h3Index: string, driverId: string): Promise<void> {
    await this.client.sadd(`h3_zone:${h3Index}`, driverId);
  }

  async removeDriverFromBucket(
    h3Index: string,
    driverId: string,
  ): Promise<void> {
    await this.client.srem(`h3_zone:${h3Index}`, driverId);
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, JSON.stringify(value), { ex: ttl });
    } else {
      await this.client.set(key, JSON.stringify(value));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    return typeof data === "string"  JSON.parse(data) : (data as T);
  }
}
