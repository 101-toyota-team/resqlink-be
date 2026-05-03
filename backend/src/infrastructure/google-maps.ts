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
    destinations: string[]
  ): Promise<GoogleDistanceMatrixResponse> {
    const originsQuery = origins.join("|");
    const destinationsQuery = destinations.join("|");
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      originsQuery
    )}&destinations=${encodeURIComponent(destinationsQuery)}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Maps API error: ${response.status} ${errorText}`);
    }
    return response.json() as Promise<GoogleDistanceMatrixResponse>;
  }

  async getDirections(
    origin: string,
    destination: string
  ): Promise<GoogleDirectionsResponse> {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(destination)}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Maps API error: ${response.status} ${errorText}`);
    }
    return response.json() as Promise<GoogleDirectionsResponse>;
  }

  async searchPlaces(query: string): Promise<GooglePlacesResponse> {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Maps API error: ${response.status} ${errorText}`);
    }
    return response.json() as Promise<GooglePlacesResponse>;
  }
}
