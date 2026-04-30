import { Redis } from '@upstash/redis/cloudflare';
import { ICacheRepository } from '../repositories/cache';

export class UpstashRedisRepository implements ICacheRepository {
  private client: Redis;

  constructor(url: string, token: string) {
    this.client = new Redis({ url, token });
  }

  async getDriversInBucket(h3Index: string): Promise<string[]> {
    return await this.client.smembers(`h3_zone:${h3Index}`);
  }

  async updateDriverLocation(driverId: string, locationData: any, h3Index: string, ttl: number): Promise<void> {
    const pipeline = this.client.pipeline();
    // Update location with TTL
    pipeline.set(`driver:loc:${driverId}`, JSON.stringify(locationData), { ex: ttl });
    // Add to H3 bucket
    pipeline.sadd(`h3_zone:${h3Index}`, driverId);
    await pipeline.exec();
  }

  async getDriverLocation(driverId: string): Promise<any | null> {
    return await this.client.get(`driver:loc:${driverId}`);
  }

  async addDriverToBucket(h3Index: string, driverId: string): Promise<void> {
    await this.client.sadd(`h3_zone:${h3Index}`, driverId);
  }

  async removeDriverFromBucket(h3Index: string, driverId: string): Promise<void> {
    await this.client.srem(`h3_zone:${h3Index}`, driverId);
  }
}
