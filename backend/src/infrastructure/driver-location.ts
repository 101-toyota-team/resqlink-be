import { IDriverLocationRepository } from "../repositories/driver-location";
import { DriverLocation } from "../types";
import { IGenericCache } from "../repositories/generic-cache";
import { SupabaseClientBase } from "./supabase/client";

const DRIVER_LOCATION_PREFIX = "driver:location:";
const DRIVER_LOCATION_TTL = 300;

export class DriverLocationRepository
  extends SupabaseClientBase
  implements IDriverLocationRepository
{
  private cache: IGenericCache;
  private batchBuffer: Array<{
    driver_id: string;
    location: DriverLocation;
  }> = [];

  constructor(url: string, key: string, cache: IGenericCache) {
    super(url, key);
    this.cache = cache;
  }

  async updateLatest(
    driverId: string,
    location: DriverLocation,
  ): Promise<void> {
    const key = `${DRIVER_LOCATION_PREFIX}${driverId}`;
    await this.cache.set(key, location, DRIVER_LOCATION_TTL);

    this.batchBuffer.push({ driver_id: driverId, location });
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

  async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const batch = this.batchBuffer.splice(0, this.batchBuffer.length);

    const rows = batch.map((b) => ({
      driver_id: b.driver_id,
      booking_id: b.location.booking_id || null,
      lat: b.location.lat,
      lng: b.location.lng,
      heading: b.location.heading ?? null,
      speed: b.location.speed ?? null,
      accuracy: b.location.accuracy ?? null,
      captured_at: b.location.captured_at,
    }));

    const { error } = await this.client.from("driver_locations").insert(rows);

    if (error) {
      this.batchBuffer.unshift(...batch);
      throw new Error(`Failed to flush driver locations: ${error.message}`);
    }
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
