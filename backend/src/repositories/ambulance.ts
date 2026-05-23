import { AmbulanceInfo, DriverDetails } from "../types";

export interface IAmbulanceRepository {
  getAmbulance(ambulanceId: string): Promise<AmbulanceInfo | null>;
  findAvailableAmbulances(h3Indexes: string[]): Promise<DriverDetails[]>;
  getAmbulanceProviderLocation(
    ambulanceId: string,
  ): Promise<{ lat: number; lng: number } | null>;
}
