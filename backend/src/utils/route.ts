import { Hono, Context } from "hono";
import { Bindings } from "../schemas/env";
import { AppVariables } from "../types";

type AppEnv = { Bindings: Bindings; Variables: AppVariables };

export function createRouteApp() {
  return new Hono<AppEnv>();
}

export const getWaitUntil = (c: Context<AppEnv>) => {
  try {
    return c.executionCtx?.waitUntil?.bind(c.executionCtx);
  } catch {
    return undefined;
  }
};

export function normalizeCoordinate(coord: number): string {
  return coord.toFixed(4);
}

export function calculateViewport(points: { lat: number; lng: number }[]) {
  if (!points || points.length === 0) {
    return { low: { lat: 0, lng: 0 }, high: { lat: 0, lng: 0 } };
  }
  let minLat = points[0].lat,
    maxLat = points[0].lat;
  let minLng = points[0].lng,
    maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return {
    low: { lat: minLat, lng: minLng },
    high: { lat: maxLat, lng: maxLng },
  };
}
