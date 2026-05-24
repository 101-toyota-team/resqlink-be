import { Hospital, HospitalDetails } from "../types";

export interface IHospitalRepository {
  searchHospitals(raw: string, expanded: string): Promise<Hospital[]>;
  findHospitalsByH3Indexes(h3Indexes: string[]): Promise<HospitalDetails[]>;
}
