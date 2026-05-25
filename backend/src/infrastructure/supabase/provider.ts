import { IProviderRepository } from "../../repositories/provider";
import { SupabaseClientBase } from "./client";
import { Provider } from "../../types";
import { DatabaseSchemaDriftError } from "../../utils/constants";
import { dbProviderSchema } from "../../schemas/db";
import logger from "../../utils/logger";

export class ProviderRepository
  extends SupabaseClientBase
  implements IProviderRepository
{
  async searchProviders(
    raw: string,
    expanded: string,
    limit?: number,
  ): Promise<Provider[]> {
    const params: Record<string, unknown> = {
      search_term: expanded,
      raw_term: raw,
    };
    if (limit !== undefined) params.max_results = limit;
    const { data, error } = await this.client.rpc(
      "search_providers_optimized",
      params,
    );

    if (error) {
      logger.error(error, "Supabase searchProviders error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return dbProviderSchema.array().parse(data || []);
    } catch (err) {
      logger.error(err, "Database schema drift detected in searchProviders");
      throw new DatabaseSchemaDriftError("Provider", err);
    }
  }

  async findProvidersByH3Indexes(h3Indexes: string[]): Promise<Provider[]> {
    if (h3Indexes.length === 0) return [];
    const { data, error } = await this.client
      .from("providers")
      .select("*")
      .in("h3_index", h3Indexes);

    if (error) {
      logger.error(error, "Supabase findProvidersByH3Indexes error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return dbProviderSchema.array().parse(data || []);
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in findProvidersByH3Indexes",
      );
      throw new DatabaseSchemaDriftError("Provider", err);
    }
  }
}
