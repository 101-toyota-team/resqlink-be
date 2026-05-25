import { IAmbulanceRepository } from "../../repositories/ambulance";
import { SupabaseClientBase } from "./client";
import { AmbulanceInfo, AmbulanceDetails } from "../../types";
import { DatabaseSchemaDriftError } from "../../utils/constants";
import {
  dbAmbulanceDiscoverySchema,
  dbAmbulanceSchema,
  dbAmbulanceProviderSchema,
} from "../../schemas/db";
import logger from "../../utils/logger";

export class AmbulanceRepository
  extends SupabaseClientBase
  implements IAmbulanceRepository
{
  async getAmbulance(ambulanceId: string): Promise<AmbulanceInfo | null> {
    const { data, error } = await this.client
      .from("ambulances")
      .select("id, provider_id")
      .eq("id", ambulanceId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      logger.error(error, "Supabase getAmbulance error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return dbAmbulanceSchema.parse(data);
    } catch (err) {
      logger.error(err, "Database schema drift detected in getAmbulance");
      throw new DatabaseSchemaDriftError("Ambulance", err);
    }
  }

  async findAvailableAmbulances(
    h3Indexes: string[],
  ): Promise<AmbulanceDetails[]> {
    const { data, error } = await this.client
      .from("ambulances")
      .select(
        `
        id,
        providers!inner (
          latitude,
          longitude
        )
      `,
      )
      .eq("status", "available")
      .in("providers.h3_index", h3Indexes);

    if (error) {
      logger.error(error, "Supabase findAvailableAmbulances error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      const results = dbAmbulanceDiscoverySchema.array().parse(data || []);
      return results.map((item) => {
        const provider = Array.isArray(item.providers)
          ? item.providers[0]
          : item.providers;
        return {
          id: item.id,
          lat: provider?.latitude ?? 0,
          lng: provider?.longitude ?? 0,
        };
      });
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in findAvailableAmbulances",
      );
      throw new DatabaseSchemaDriftError("Ambulance", err);
    }
  }

  async getAmbulanceProviderLocation(
    ambulanceId: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const { data, error } = await this.client
      .from("ambulances")
      .select(
        `
        providers (
          latitude,
          longitude
        )
      `,
      )
      .eq("id", ambulanceId)
      .single();

    if (error || !data) {
      logger.error(error, "Supabase getAmbulanceProviderLocation error");
      throw new Error(`Supabase error: ${error?.message}`, { cause: error });
    }

    try {
      const parsed = dbAmbulanceProviderSchema.parse(data);
      const providerData = parsed.providers;
      if (!providerData) return null;

      const provider = Array.isArray(providerData)
        ? providerData[0]
        : providerData;

      if (!provider) return null;

      return {
        lat: provider.latitude,
        lng: provider.longitude,
      };
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in getAmbulanceProviderLocation",
      );
      throw new DatabaseSchemaDriftError("AmbulanceProvider", err);
    }
  }
}
