import { Hospital, HospitalDetails } from "../types";

export interface IHospitalRepository {
  searchHospitals(query: string): Promise<Hospital[]>;
  findHospitalsByH3Indexes(h3Indexes: string[]): Promise<HospitalDetails[]>;
}
