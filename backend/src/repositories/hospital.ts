import { Hospital, HospitalDetails } from "../types";

export interface IHospitalRepository {
  searchHospitals(
    raw: string,
    expanded: string,
    limit?: number,
  ): Promise<Hospital[]>;
  findHospitalsByH3Indexes(h3Indexes: string[]): Promise<HospitalDetails[]>;
}
