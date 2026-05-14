import { ProviderDetails, PaginatedProviders } from "../types";
import { IPersistenceRepository } from "../repositories/db";
import { IGeoService } from "./geo";
import { preprocessQuery } from "../utils/query";
import { PROVIDER_SEARCH } from "../utils/constants";

export interface IProviderService {
  searchProviders(query: string): Promise<ProviderDetails[]>;
  findNearbyProviders(
    h3Index: string,
    lat?: number,
    lng?: number,
    page?: number,
    perPage?: number,
  ): Promise<PaginatedProviders>;
}

export class ProviderService implements IProviderService {
  constructor(
    private db: IPersistenceRepository,
    private geo: IGeoService,
  ) {}

  async searchProviders(query: string): Promise<ProviderDetails[]> {
    const { raw, expanded } = preprocessQuery(query);
    return this.db.searchProviders(raw, expanded);
  }

  async findNearbyProviders(
    h3Index: string,
    lat?: number,
    lng?: number,
    page = 1,
    perPage = PROVIDER_SEARCH.DEFAULT_PAGE_SIZE,
  ): Promise<PaginatedProviders> {
    const center =
      lat !== undefined && lng !== undefined
        ? { lat, lng }
        : this.geo.cellToLatLng(h3Index);

    const allCells = this.geo.getNeighbors(
      h3Index,
      PROVIDER_SEARCH.MAX_RING_DISTANCE,
    );
    const providers = await this.db.findProvidersByH3Indexes(allCells);

    const withDistance: ProviderDetails[] = providers.map((p) => ({
      ...p,
      distance: `${this.geo.haversineDistance(center.lat, center.lng, p.latitude, p.longitude).toFixed(2)} km`,
    }));

    withDistance.sort(
      (a, b) => parseFloat(a.distance!) - parseFloat(b.distance!),
    );

    const total = withDistance.length;
    const start = (page - 1) * perPage;
    const paginated = withDistance.slice(start, start + perPage);

    return { providers: paginated, total, page, per_page: perPage };
  }
}
