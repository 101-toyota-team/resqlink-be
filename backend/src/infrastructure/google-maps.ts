import {
  GoogleDirectionsResponse,
  GoogleDistanceMatrixResponse,
  GooglePlacesResponse,
} from "../types";
import { fetchWithTimeout } from "./util";
import { IMapsRepository } from "../repositories/maps";

export class GoogleMapsRepository implements IMapsRepository {
  constructor(private apiKey: string) {}

  async getDistanceMatrix(
    origins: string[],
    destinations: string[],
  ): Promise<GoogleDistanceMatrixResponse> {
    const originsQuery = origins.join("|");
    const destinationsQuery = destinations.join("|");
    const url = `https://maps.googleapis.com/maps/api/distancematrix/jsonorigins=${originsQuery}&destinations=${destinationsQuery}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    return response.json() as Promise<GoogleDistanceMatrixResponse>;
  }

  async getDirections(
    origin: string,
    destination: string,
  ): Promise<GoogleDirectionsResponse> {
    const url = `https://maps.googleapis.com/maps/api/directions/jsonorigin=${origin}&destination=${destination}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    return response.json() as Promise<GoogleDirectionsResponse>;
  }

  async searchPlaces(query: string): Promise<GooglePlacesResponse> {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/jsonquery=${encodeURIComponent(
      query,
    )}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    return response.json() as Promise<GooglePlacesResponse>;
  }
}
