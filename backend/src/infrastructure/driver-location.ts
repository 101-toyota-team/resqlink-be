import { IDriverLocationRepository } from "../repositories/driver-location";
import { DriverLocation } from "../types";
import { IGenericCache } from "../repositories/generic-cache";
import { SupabaseClientBase } from "./supabase/client";
import type { ILogger } from "../types";

const DRIVER_LOCATION_PREFIX = "driver:location:";
const DRIVER_LOCATION_TTL = 300;

export class DriverLocationRepository
  extends SupabaseClientBase
  implements IDriverLocationRepository
{
  private cache: IGenericCache;

  constructor(url: string, key: string, cache: IGenericCache, logger: ILogger) {
    super(url, key, logger);
    this.cache = cache;
  }

  async updateLatest(
    driverId: string,
    location: DriverLocation,
  ): Promise<void> {
    const key = `${DRIVER_LOCATION_PREFIX}${driverId}`;

    // NOTE: For high-volume production, consider buffering/batching updates via Redis Streams
    // to reduce DB IOPS. Direct inserts are used here for immediate data durability.
    const tasks: Promise<void>[] = [
      this.cache.set(key, location, DRIVER_LOCATION_TTL),
      (async () => {
        const { error } = await this.client
          .from("driver_locations")
          .insert({
            driver_id: driverId,
            booking_id: location.booking_id || null,
            lat: location.lat,
            lng: location.lng,
            heading: location.heading ?? null,
            speed: location.speed ?? null,
            accuracy: location.accuracy ?? null,
            captured_at: location.captured_at,
          });
        if (error) throw error;
      })(),
    ];

    await Promise.all(tasks);
  }
  async getLatest(driverId: string): Promise<DriverLocation | null> {
    const key = `${DRIVER_LOCATION_PREFIX}${driverId}`;
    return this.cache.get<DriverLocation>(key);
  }

  async getLatestBatch(
    driverIds: string[],
  ): Promise<(DriverLocation | null)[]> {
    const keys = driverIds.map((id) => `${DRIVER_LOCATION_PREFIX}${id}`);
    return this.cache.mget<DriverLocation>(keys);
  }

  async getTripHistory(
    bookingId: string,
    limit: number = 500,
  ): Promise<DriverLocation[]> {
    const { data, error } = await this.client
      .from("driver_locations")
      .select("*")
      .eq("booking_id", bookingId)
      .order("captured_at", { ascending: true })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
      lat: Number(row.lat),
      lng: Number(row.lng),
      heading: row.heading ? Number(row.heading) : undefined,
      speed: row.speed ? Number(row.speed) : undefined,
      accuracy: row.accuracy ? Number(row.accuracy) : undefined,
      captured_at: String(row.captured_at),
      booking_id: row.booking_id ? String(row.booking_id) : undefined,
    }));
  }
}
