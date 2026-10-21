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
};

export const REDIS = {
  PREFIXES: {
    DIST_CACHE: "dist_cache:",
  },
  TTLS: {
    DISTANCE_CACHE: DISTANCE_SERVICE.CACHE_TTL_SECONDS,
  },
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
  UNAUTHORIZED: "Unauthorized access",
  INTERNAL_ERROR: "Internal server error",
  BOOKING_NOT_FOUND: "Booking not found",
  FORBIDDEN_ACCESS: "You do not have permission to access this resource",
  INVALID_TOKEN: "Invalid token",
  CONFIGURATION_ERROR: "Configuration error",
  VALIDATION_FAILED: "Validation failed",
  AMBULANCE_NOT_FOUND: "Ambulance not found",
  BOOKING_NOT_DRAFT: "Booking is not in draft status",
  AMBULANCE_PROVIDER_MISMATCH:
    "Ambulance does not belong to the selected provider",
  INVALID_BOOKING_TRANSITION: "Invalid booking status transition",
  NO_ASSIGNED_AMBULANCE: "Booking has no assigned ambulance",
  DRIVER_NOT_FOUND: "Driver not found",
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
