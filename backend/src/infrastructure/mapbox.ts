import {
  DirectionsResponse,
  DistanceMatrixResponse,
  DistanceMatrixElement,
} from "../types";
import { fetchWithTimeout } from "./util";
import { IMapsRepository } from "../repositories/maps";
import { formatDistance, formatDuration } from "../utils/format";

interface MapboxDirectionsResponse {
  code: string;
  routes: Array<{
    geometry: string;
  }>;
}

interface MapboxMatrixResponse {
  code: string;
  distances: Array<Array<number | null>>;
  durations: Array<Array<number | null>>;
}

interface MapboxErrorResponse {
  message?: string;
  code?: string;
}

export class MapboxRepository implements IMapsRepository {
  constructor(private accessToken: string) {}

  private async handleResponse<T>(response: Response): Promise<T> {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Mapbox API error: ${response.status} - non-JSON response`,
      );
    }
    if (!response.ok) {
      const errorData = data as MapboxErrorResponse;
      throw new Error(
        `Mapbox API error: ${response.status} ${
          errorData.message || errorData.code
        }`,
      );
    }
    return data as T;
  }

  private swapCoords(latLng: string): string {
    const [lat, lng] = latLng.split(",");
    return `${lng.trim()},${lat.trim()}`;
  }

  private mapStatus(code: string): string {
    switch (code) {
      case "Ok":
        return "OK";
      case "NoRoute":
      case "NoSegment":
        return "ZERO_RESULTS";
      case "InvalidInput":
      case "ProfileNotFound":
        return "INVALID_REQUEST";
      default:
        return code;
    }
  }

  async getDirections(
    origin: string,
    destination: string,
  ): Promise<DirectionsResponse> {
    const originSwapped = this.swapCoords(origin);
    const destSwapped = this.swapCoords(destination);

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originSwapped};${destSwapped}.json?access_token=${this.accessToken}&geometries=polyline6&overview=full`;

    const data = await this.handleResponse<MapboxDirectionsResponse>(
      await fetchWithTimeout(url),
    );

    return {
      status: this.mapStatus(data.code),
      routes: (data.routes || []).map((route) => ({
        overview_polyline: {
          points: route.geometry,
        },
      })),
    };
  }

  async getDistanceMatrix(
    origins: string[],
    destinations: string[],
  ): Promise<DistanceMatrixResponse> {
    // Mapbox Matrix limit is 25 total coordinates.
    // If origins + destinations > 25, we chunk the origins.
    const maxTotal = 25;
    const destCount = destinations.length;
    const maxOriginsPerChunk = maxTotal - destCount;

    if (maxOriginsPerChunk <= 0) {
      throw new Error(
        `Too many destinations for Mapbox Matrix API (max 24, got ${destCount})`,
      );
    }

    const originChunks: string[][] = [];
    for (let i = 0; i < origins.length; i += maxOriginsPerChunk) {
      originChunks.push(origins.slice(i, i + maxOriginsPerChunk));
    }

    const allRows: { elements: DistanceMatrixElement[] }[] = [];

    for (const chunk of originChunks) {
      const coords = [...chunk, ...destinations]
        .map((c) => this.swapCoords(c))
        .join(";");

      const sourceIndices = chunk.map((_, i) => i).join(";");
      const destIndices = destinations
        .map((_, i) => i + chunk.length)
        .join(";");

      const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}.json?access_token=${this.accessToken}&annotations=distance,duration&sources=${sourceIndices}&destinations=${destIndices}`;

      const data = await this.handleResponse<MapboxMatrixResponse>(
        await fetchWithTimeout(url),
      );
      const status = this.mapStatus(data.code);

      if (status !== "OK") {
        // If one chunk fails, we might want to handle it.
        // For now, we'll just return the status if it's not OK.
        return { rows: [], status };
      }

      for (let i = 0; i < chunk.length; i++) {
        const elements: DistanceMatrixElement[] = [];
        for (let j = 0; j < destinations.length; j++) {
          const distance = data.distances[i][j];
          const duration = data.durations[i][j];

          elements.push({
            status: distance !== null ? "OK" : "ZERO_RESULTS",
            distance: {
              value: distance ?? 0,
              text: distance !== null ? formatDistance(distance) : "Unknown",
            },
            duration: {
              value: duration ?? 0,
              text: duration !== null ? formatDuration(duration) : "Unknown",
            },
          });
        }
        allRows.push({ elements });
      }
    }

    return {
      rows: allRows,
      status: "OK",
    };
  }
}
