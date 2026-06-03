import { IDriverRepository } from "../repositories/driver";
import { SupabaseClientBase } from "./supabase/client";
import { Driver } from "../types";
import logger from "../utils/logger";

export class DriverRepository
  extends SupabaseClientBase
  implements IDriverRepository
{
  async getDriver(driverId: string): Promise<Driver | null> {
    const { data, error } = await this.client
      .from("drivers")
      .select("*")
      .eq("id", driverId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      logger.error(error, "Supabase getDriver error");
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
      logger.error(error, "Supabase updateAvailability error");
      throw new Error(`Supabase error: ${error.message}`);
    }
  }
}
