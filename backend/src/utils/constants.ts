import type { Context } from "hono";
import type { ZodError } from "zod";

// Configuration constants for backend services

// Global H3 resolution used throughout the application.
// All H3 indexes are validated, generated, and cached at this resolution.
export const GLOBAL_H3_RESOLUTION = 7;

// Distance Service
export const DISTANCE_SERVICE = {
  CACHE_TTL_SECONDS: 300,
  MAX_DRIVERS_PER_LOCATION: 10,
  RADIUS_KM: 50,
  BATCH_SIZE: 25,
  DISTANCE_THRESHOLD_KM: 100,
};

// Upstash Redis
export const UPSTASH = {
  LOCATION_BUCKET_SIZE: 0.01,
  LOCATION_CACHE_TTL: 600,
  MAX_LOCATION_CACHE_SIZE: 1000,
};

export const REDIS = {
  PREFIXES: {
    SIM_ROUTE: "sim:route:",
    SIM_ACTIVE: "sim:active:",
    SIM_BOOKING_DRIVER: "sim:booking_driver:",
    DIST_CACHE: "dist_cache:",
  },
  TTLS: {
    SIMULATION: 3600,
    DISTANCE_CACHE: DISTANCE_SERVICE.CACHE_TTL_SECONDS,
  },
};

// Dispatch Service
export const DISPATCH = {
  MATCH_RADIUS_KM: 50,
  MAX_CONCURRENT_DISPATCHES: 5,
};

// Discovery Routes
export const DISCOVERY = {
  H3_RING_RADIUS: 1,
};

// Booking Fees
// Provider Search
export const PROVIDER_SEARCH = {
  MAX_RING_DISTANCE: 30,
  H3_BATCH_SIZE: 500,
  MAX_RESULTS: 50,
};

/** Standardised error response shape for all route handlers. */
export function errorResponse(message: string) {
  return { error: message, details: {} as Record<string, unknown> };
}

export const BOOKING_STATUSES = [
  "draft",
  "confirmed",
  "en_route",
  "arrived",
  "to_hospital",
  "completed",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Thrown when a Supabase response fails Zod schema validation,
 * indicating the database schema has drifted from the expected shape.
 */
export class DatabaseSchemaDriftError extends Error {
  constructor(entity: string, cause: unknown) {
    super(`Database schema drift detected for ${entity}`);
    this.name = "DatabaseSchemaDriftError";
    this.cause = cause;
  }
}

export const BOOKING_FEES = {
  medis: 50000,
  sosial: 0,
  jenazah: 50000,
  darurat: 100000,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_COORDINATES: "Invalid coordinates provided",
  DISPATCH_TIMEOUT: "Dispatch request timed out",
  BOOKING_FAILED: "Failed to create booking",
  DISCOVERY_FAILED: "Failed to retrieve drivers",
  HOSPITALS_FAILED: "Failed to retrieve hospitals",
  UNAUTHORIZED: "Unauthorized access",
  INTERNAL_ERROR: "Internal server error",
  BOOKING_NOT_FOUND: "Booking not found",
  FORBIDDEN_ACCESS: "You do not have permission to access this resource",
  INVALID_STATUS: "Invalid booking status provided",
  INVALID_TOKEN: "Invalid token",
  INVALID_H3_RESOLUTION:
    "H3 index must be at resolution 7 (15 hex characters). Use latLngToCell(lat, lng, 7) to generate.",
  AUTH_SERVICE_UNAVAILABLE: "Authentication service unavailable",
  CONFIGURATION_ERROR: "Configuration error",
  VALIDATION_FAILED: "Validation failed",
  MAPS_API_FAILURE: "Maps API request failed",
};

/**
 * Shared validator hook for zValidator to ensure consistent error responses.
 */
export const validatorHook = (
  result:
    | { success: true; data: unknown }
    | { success: false; error: ZodError },
  c: Context,
): Response | void => {
  if (!result.success) {
    return c.json(
      {
        error: ERROR_MESSAGES.VALIDATION_FAILED,
        details: result.error.format(),
      },
      400,
    );
  }
};
