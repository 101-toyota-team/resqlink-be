import { DirectionsResponse, DistanceMatrixResponse } from "../types";

export interface IMapsRepository {
  getDistanceMatrix(
    origins: string[],
    destinations: string[],
  ): Promise<DistanceMatrixResponse>;
  getDirections(
    origin: string,
    destination: string,
  ): Promise<DirectionsResponse>;
}
