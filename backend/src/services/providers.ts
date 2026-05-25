import { ProviderDetails } from "../types";
import { IProviderRepository } from "../repositories/provider";
import { IGeoService } from "./geo";
import { preprocessQuery } from "../utils/query";
import { PROVIDER_SEARCH } from "../utils/constants";

export interface IProviderService {
  searchProviders(query: string, limit?: number): Promise<ProviderDetails[]>;
  findNearbyProviders(
    h3Index: string,
    lat?: number,
    lng?: number,
  ): Promise<ProviderDetails[]>;
}

export class ProviderService implements IProviderService {
  constructor(
    private providerRepo: IProviderRepository,
    private geo: IGeoService,
  ) {}

  async searchProviders(
    query: string,
    limit?: number,
  ): Promise<ProviderDetails[]> {
    const { raw, expanded } = preprocessQuery(query);
    return this.providerRepo.searchProviders(raw, expanded, limit);
  }

  async findNearbyProviders(
    h3Index: string,
    lat?: number,
    lng?: number,
  ): Promise<ProviderDetails[]> {
    const center =
      lat !== undefined && lng !== undefined
        ? { lat, lng }
        : this.geo.cellToLatLng(h3Index);

    const providers: ProviderDetails[] = [];
    const RING_STEP = 3;
    let lookaheadDone = false;

    for (
      let ringStart = 0;
      ringStart <= PROVIDER_SEARCH.MAX_RING_DISTANCE;
      ringStart += RING_STEP
    ) {
      const ringEnd = Math.min(
        ringStart + RING_STEP - 1,
        PROVIDER_SEARCH.MAX_RING_DISTANCE,
      );
      const cells: string[] = [];

      for (let r = ringStart; r <= ringEnd; r++) {
        if (r === 0) {
          cells.push(h3Index);
        } else {
          cells.push(...this.geo.getRing(h3Index, r));
        }
      }

      for (let i = 0; i < cells.length; i += PROVIDER_SEARCH.H3_BATCH_SIZE) {
        const batch = cells.slice(i, i + PROVIDER_SEARCH.H3_BATCH_SIZE);
        const result = await this.providerRepo.findProvidersByH3Indexes(batch);
        providers.push(...result);
      }

      if (lookaheadDone) break;

      if (providers.length >= PROVIDER_SEARCH.MAX_RESULTS) {
        lookaheadDone = true;
      }
    }

    const withDistance = providers.map((p) => {
      const dist = this.geo.haversineDistance(
        center.lat,
        center.lng,
        p.latitude,
        p.longitude,
      );
      return {
        ...p,
        distance: `${dist.toFixed(2)} km`,
        distance_value: dist * 1000,
      };
    });

    withDistance.sort((a, b) => a.distance_value! - b.distance_value!);

    return withDistance.slice(0, PROVIDER_SEARCH.MAX_RESULTS);
  }
}
