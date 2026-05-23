import { AmbulanceInfo, AmbulanceDetails } from "../types";

export interface IAmbulanceRepository {
  getAmbulance(ambulanceId: string): Promise<AmbulanceInfo | null>;
  findAvailableAmbulances(h3Indexes: string[]): Promise<AmbulanceDetails[]>;
  getAmbulanceProviderLocation(
    ambulanceId: string,
  ): Promise<{ lat: number; lng: number } | null>;
}
