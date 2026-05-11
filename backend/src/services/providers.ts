import { Provider, ProviderDetails } from "../types";
import { IPersistenceRepository } from "../repositories/db";
import { IGeoService } from "./geo";
import { preprocessQuery } from "../utils/query";

export interface IProviderService {
  searchProviders(query: string): Promise<Provider[]>;
  findNearbyProviders(h3Index: string): Promise<ProviderDetails[]>;
}

export class ProviderService implements IProviderService {
  constructor(
    private db: IPersistenceRepository,
    private geo: IGeoService,
  ) {}

  async searchProviders(query: string): Promise<Provider[]> {
    const expandedQuery = preprocessQuery(query);
    return this.db.searchProviders(expandedQuery);
  }

  async findNearbyProviders(h3Index: string): Promise<ProviderDetails[]> {
    const neighboringCells = this.geo.getNeighbors(h3Index, 1);
    const providers = await this.db.findProvidersByH3Indexes(neighboringCells);

    // For now, we just return the providers.
    // If distance calculation is needed, it would be added here.
    return providers.map((p) => ({
      ...p,
    }));
  }
}
