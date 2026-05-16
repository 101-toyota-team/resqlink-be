import * as h3 from "h3-js";

export interface IGeoService {
  getNeighbors(h3Index: string, radius: number): string[];
  latLngToCell(lat: number, lng: number, resolution: number): string;
  parseLatLng(location: string): { lat: number; lng: number };
  cellToLatLng(h3Index: string): { lat: number; lng: number };
  haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number;
}

export class GeoService implements IGeoService {
  getNeighbors(h3Index: string, radius: number): string[] {
    return h3.gridDisk(h3Index, radius);
  }

  latLngToCell(lat: number, lng: number, resolution: number): string {
    return h3.latLngToCell(lat, lng, resolution);
  }

  parseLatLng(location: string): { lat: number; lng: number } {
    const [latStr, lngStr] = location.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new Error("Invalid coordinate values");
    }

    return { lat, lng };
  }

  cellToLatLng(h3Index: string): { lat: number; lng: number } {
    const [lat, lng] = h3.cellToLatLng(h3Index);
    return { lat, lng };
  }

  haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
