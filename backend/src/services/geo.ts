import * as h3 from "h3-js";

export interface IGeoService {
  getNeighbors(h3Index: string, radius: number): string[];
  latLngToCell(lat: number, lng: number, resolution: number): string;
  parseLatLng(location: string): { lat: number; lng: number };
}

export class GeoService implements IGeoService {
  getNeighbors(h3Index: string, radius: number): string[] {
    return h3.gridDisk(h3Index, radius);
  }

  latLngToCell(lat: number, lng: number, resolution: number): string {
    return h3.latLngToCell(lat, lng, resolution);
  }

  parseLatLng(location: string): { lat: number; lng: number } {
    const [lat, lng] = location.split(",").map(Number);
    return { lat, lng };
  }
}
