import {
  GoogleDirectionsResponse,
  GoogleDistanceMatrixResponse,
} from "../types";
import { fetchWithTimeout } from "./util";
import { IMapsRepository } from "../repositories/maps";
import logger from "../utils/logger";

// Type guards for Google Maps API responses
function isValidDistanceMatrix(
  data: unknown,
): data is GoogleDistanceMatrixResponse {
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

export class GoogleMapsRepository implements IMapsRepository {
  constructor(private apiKey: string) {}

  private async handleResponse(response: Response): Promise<Response> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Maps API error: ${response.status} ${errorText}`);
    }
    return response;
  }

  async getDistanceMatrix(
    origins: string[],
    destinations: string[],
  ): Promise<GoogleDistanceMatrixResponse> {
    const originsQuery = origins.join("|");
    const destinationsQuery = destinations.join("|");
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      originsQuery,
    )}&destinations=${encodeURIComponent(destinationsQuery)}&key=${this.apiKey}`;

    const response = await this.handleResponse(await fetchWithTimeout(url));
    const data = await response.json();
    if (!isValidDistanceMatrix(data)) {
      logger.error({ data }, "Invalid distance matrix response");
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

    const response = await this.handleResponse(await fetchWithTimeout(url));
    const data = await response.json();
    if (!isValidDirections(data)) {
      logger.error({ data }, "Invalid directions response");
      throw new Error("Invalid response from Google Directions API");
    }
    return data;
  }
}
