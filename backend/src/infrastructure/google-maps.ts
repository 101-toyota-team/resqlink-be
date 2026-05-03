import {
  GoogleDirectionsResponse,
  GoogleDistanceMatrixResponse,
  GooglePlacesResponse,
} from "../types";
import { fetchWithTimeout } from "./util";
import { IMapsRepository } from "../repositories/maps";
import logger from "../utils/logger";

// Type guards for Google Maps API responses
function isValidDistanceMatrix(data: unknown): data is GoogleDistanceMatrixResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).status === "string" &&
    Array.isArray((data as Record<string, unknown>).rows)
  );
}

function isValidDirections(data: unknown): data is GoogleDirectionsResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).status === "string" &&
    Array.isArray((data as Record<string, unknown>).routes)
  );
}

function isValidPlaces(data: unknown): data is GooglePlacesResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).status === "string" &&
    Array.isArray((data as Record<string, unknown>).results)
  );
}

export class GoogleMapsRepository implements IMapsRepository {
  constructor(private apiKey: string) {}

  async getDistanceMatrix(
    origins: string[],
    destinations: string[],
  ): Promise<GoogleDistanceMatrixResponse> {
    const originsQuery = origins.join("|");
    const destinationsQuery = destinations.join("|");
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      originsQuery,
    )}&destinations=${encodeURIComponent(destinationsQuery)}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Maps API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    if (!isValidDistanceMatrix(data)) {
      logger.error("Invalid distance matrix response: %O", data);
      throw new Error("Invalid response from Google Distance Matrix API");
    }
    return data;
  }

  async getDirections(
    origin: string,
    destination: string,
  ): Promise<GoogleDirectionsResponse> {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      origin,
    )}&destination=${encodeURIComponent(destination)}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Maps API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    if (!isValidDirections(data)) {
      logger.error("Invalid directions response: %O", data);
      throw new Error("Invalid response from Google Directions API");
    }
    return data;
  }

  async searchPlaces(query: string): Promise<GooglePlacesResponse> {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query,
    )}&key=${this.apiKey}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Maps API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    if (!isValidPlaces(data)) {
      logger.error("Invalid places response: %O", data);
      throw new Error("Invalid response from Google Places API");
    }
    return data;
  }
}
