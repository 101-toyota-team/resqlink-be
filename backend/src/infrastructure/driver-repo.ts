import { IDriverRepository } from "../repositories/driver";
import { SupabaseClientBase } from "./supabase/client";
import { Driver } from "../types";
import type { ILogger } from "../types";

export class DriverRepository
  extends SupabaseClientBase
  implements IDriverRepository
{
  constructor(url: string, key: string, logger: ILogger) {
    super(url, key, logger);
  }

  async getDriver(driverId: string): Promise<Driver | null> {
    const { data, error } = await this.client
      .from("drivers")
      .select("*")
      .eq("id", driverId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      this.logger.error(error, "Supabase getDriver error");
      return null;
    }

    return data as Driver;
  }

  async updateAvailability(
    driverId: string,
    isAvailable: boolean,
  ): Promise<void> {
    const { error } = await this.client
      .from("drivers")
      .update({ is_available: isAvailable })
      .eq("id", driverId);

    if (error) {
      this.logger.error(error, "Supabase updateAvailability error");
      throw new Error(`Supabase error: ${error.message}`);
    }
  }
}
