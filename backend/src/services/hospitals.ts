import { Hospital, HospitalDetails } from "../types";
import { IPersistenceRepository } from "../repositories/db";
import { IGeoService } from "./geo";
import { preprocessQuery } from "../utils/query";

export interface IHospitalService {
  searchHospitals(query: string): Promise<Hospital[]>;
  findNearbyHospitals(h3Index: string): Promise<HospitalDetails[]>;
}

export class HospitalService implements IHospitalService {
  constructor(
    private db: IPersistenceRepository,
    private geo: IGeoService,
  ) {}

  async searchHospitals(query: string): Promise<Hospital[]> {
    const { raw } = preprocessQuery(query);
    return this.db.searchHospitals(raw);
  }

  async findNearbyHospitals(h3Index: string): Promise<HospitalDetails[]> {
    const neighboringCells = this.geo.getNeighbors(h3Index, 1);
    return this.db.findHospitalsByH3Indexes(neighboringCells);
  }
}
