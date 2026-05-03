import {
  GoogleDirectionsResponse,
  GoogleDistanceMatrixResponse,
  GooglePlacesResponse,
} from "../types";
import { fetchWithTimeout } from "./util";

export class GoogleMapsRepository {
  constructor(private apiKey: string) {}

  async getDistanceMatrix(
    origins: string[],
    destinations: string[],
  ): Promise<GoogleDistanceMatrixResponse> {
    const originsQuery = origins.join("|");
    const destinationsQuery = destinations.join("|");
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsQuery}&destinations=${destinationsQuery}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    return response.json() as Promise<GoogleDistanceMatrixResponse>;
  }

  async getDirections(
    origin: string,
    destination: string,
  ): Promise<GoogleDirectionsResponse> {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    return response.json() as Promise<GoogleDirectionsResponse>;
  }

  async searchPlaces(query: string): Promise<GooglePlacesResponse> {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query,
    )}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    return response.json() as Promise<GooglePlacesResponse>;
  }
}
