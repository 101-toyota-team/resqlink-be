import { Hospital, HospitalDetails } from "../types";
import { IHospitalRepository } from "../repositories/hospital";
import { IGeoService } from "./geo";
import { preprocessQuery } from "../utils/query";

export interface IHospitalService {
  searchHospitals(query: string): Promise<Hospital[]>;
  findNearbyHospitals(h3Index: string): Promise<HospitalDetails[]>;
}

export class HospitalService implements IHospitalService {
  constructor(
    private hospitalRepo: IHospitalRepository,
    private geo: IGeoService,
  ) {}

  async searchHospitals(query: string): Promise<Hospital[]> {
    const { raw, expanded } = preprocessQuery(query);
    return this.hospitalRepo.searchHospitals(raw, expanded);
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
        distance: `${dist.toFixed(2)} km`,
        distance_value: dist * 1000,
      };
    });
  }
}
