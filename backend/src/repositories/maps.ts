import { GoogleDirectionsResponse, GoogleDistanceMatrixResponse, GooglePlacesResponse } from "../types";

export interface IMapsRepository {
  getDistanceMatrix(
    origins: string[],
    destinations: string[],
  ): Promise<GoogleDistanceMatrixResponse>;
  getDirections(
    origin: string,
    destination: string,
  ): Promise<GoogleDirectionsResponse>;
  searchPlaces(query: string): Promise<GooglePlacesResponse>;
}
