import { Hospital, HospitalDetails } from "../types";
import { formatDistance } from "../utils/format";
import { IHospitalRepository } from "../repositories/hospital";
import { IGeoService } from "./geo";
import { preprocessQuery } from "../utils/query";
import type { ILogger } from "../types";

export interface IHospitalService {
  searchHospitals(query: string, limit?: number): Promise<Hospital[]>;
  findNearbyHospitals(h3Index: string): Promise<HospitalDetails[]>;
}

export class HospitalService implements IHospitalService {
  constructor(
    private hospitalRepo: IHospitalRepository,
    private geo: IGeoService,
    private logger: ILogger,
  ) {}

  async searchHospitals(query: string, limit?: number): Promise<Hospital[]> {
    const { raw, expanded } = preprocessQuery(query);
    return this.hospitalRepo.searchHospitals(raw, expanded, limit);
  }

  async findNearbyHospitals(h3Index: string): Promise<HospitalDetails[]> {
    const neighboringCells = this.geo.getNeighbors(h3Index, 1);
    const center = this.geo.cellToLatLng(h3Index);
    const results =
      await this.hospitalRepo.findHospitalsByH3Indexes(neighboringCells);
    return results.map((h) => {
      const dist = this.geo.haversineDistance(
        center.lat,
        center.lng,
        h.latitude,
        h.longitude,
      );
      return {
        ...h,
        distance: formatDistance(dist * 1000),
        distance_value: dist * 1000,
      };
    });
  }
}
