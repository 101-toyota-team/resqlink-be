import { Redis } from "@upstash/redis/cloudflare";
import { IGenericCache } from "../repositories/generic-cache";
import logger from "../utils/logger";
import type { z } from "zod";

export class UpstashRedisRepository implements IGenericCache {
  private client: Redis;

  constructor(url: string, token: string) {
    this.client = new Redis({ url, token });
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
