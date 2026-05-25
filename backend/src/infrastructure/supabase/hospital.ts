import { z } from "zod";
import { IHospitalRepository } from "../../repositories/hospital";
import { SupabaseClientBase } from "./client";
import { Hospital, HospitalDetails } from "../../types";
import { DatabaseSchemaDriftError } from "../../utils/constants";
import { dbHospitalSchema } from "../../schemas/db";
import logger from "../../utils/logger";

export class HospitalRepository
  extends SupabaseClientBase
  implements IHospitalRepository
{
  private mapHospitalItem(
    item: z.infer<typeof dbHospitalSchema>,
  ): Hospital | null {
    const provider = Array.isArray(item.providers)
      ? item.providers[0]
      : item.providers;
    if (!provider) return null;
    return {
      id: provider.id,
      name: provider.name,
      h3_index: provider.h3_index,
      latitude: provider.latitude,
      longitude: provider.longitude,
      provider_type: provider.provider_type,
      address: provider.address,
      phone: provider.phone,
      created_at: provider.created_at,
      igd_phone: item.igd_phone,
      igd_email: item.igd_email,
      bed_capacity: item.bed_capacity,
      specializations: item.specializations,
      accreditation: item.accreditation,
      rating: item.rating,
      rating_count: item.rating_count,
      website_url: item.website_url,
    };
  }

  async searchHospitals(
    raw: string,
    expanded: string,
    limit?: number,
  ): Promise<Hospital[]> {
    const params: Record<string, unknown> = {
      search_term: expanded,
      raw_term: raw,
    };
    if (limit !== undefined) params.max_results = limit;
    const { data: ids, error: rpcError } = await this.client.rpc(
      "search_hospitals_optimized",
      params,
    );

    if (rpcError) {
      logger.error(rpcError, "Supabase searchHospitals RPC error");
      throw new Error(`Supabase error: ${rpcError.message}`, {
        cause: rpcError,
      });
    }

    if (!ids || ids.length === 0) return [];

    const hospitalIds = ids.map((r: { hospital_id: string }) => r.hospital_id);
    const providerOrderMap = new Map(
      ids.map((r: { provider_id: string }, i: number) => [r.provider_id, i]),
    );

    const { data, error } = await this.client
      .from("hospitals")
      .select(
        `
        id,
        provider_id,
        igd_phone,
        igd_email,
        bed_capacity,
        specializations,
        accreditation,
        rating,
        rating_count,
        website_url,
        providers!inner (
          id,
          name,
          h3_index,
          latitude,
          longitude,
          provider_type,
          address,
          phone,
          created_at
        )
      `,
      )
      .in("id", hospitalIds);

    if (error) {
      logger.error(error, "Supabase searchHospitals error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      const rawResults = dbHospitalSchema.array().parse(data || []);
      return rawResults
        .map((item): Hospital | null => this.mapHospitalItem(item))
        .filter((h): h is Hospital => h !== null)
        .sort(
          (a, b) =>
            ((providerOrderMap.get(a.id) ?? Infinity) as number) -
            ((providerOrderMap.get(b.id) ?? Infinity) as number),
        );
    } catch (err) {
      logger.error(err, "Database schema drift detected in searchHospitals");
      throw new DatabaseSchemaDriftError("Hospital", err);
    }
  }

  async findHospitalsByH3Indexes(
    h3Indexes: string[],
  ): Promise<HospitalDetails[]> {
    if (h3Indexes.length === 0) return [];
    const { data, error } = await this.client
      .from("hospitals")
      .select(
        `
        id,
        provider_id,
        igd_phone,
        igd_email,
        bed_capacity,
        specializations,
        accreditation,
        rating,
        rating_count,
        website_url,
        providers!inner (
          id,
          name,
          h3_index,
          latitude,
          longitude,
          provider_type,
          address,
          phone,
          created_at
        )
      `,
      )
      .eq("providers.provider_type", "rumah_sakit")
      .in("providers.h3_index", h3Indexes)
      .order("providers.name", { ascending: true });

    if (error) {
      logger.error(error, "Supabase findHospitalsByH3Indexes error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      const rawResults = dbHospitalSchema.array().parse(data || []);
      return rawResults
        .map((item): HospitalDetails | null => this.mapHospitalItem(item))
        .filter((h): h is HospitalDetails => h !== null);
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in findHospitalsByH3Indexes",
      );
      throw new DatabaseSchemaDriftError("Hospital", err);
    }
  }
}
