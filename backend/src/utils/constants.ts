// Configuration constants for backend services

// Distance Service
export const DISTANCE_SERVICE = {
  CACHE_TTL_SECONDS: 300,
  MAX_DRIVERS_PER_LOCATION: 10,
  RADIUS_KM: 50,
  BATCH_SIZE: 25,
  DISTANCE_THRESHOLD_KM: 100,
  H3_RESOLUTION: 10,
};

// Upstash Redis
export const UPSTASH = {
  LOCATION_BUCKET_SIZE: 0.01,
  LOCATION_CACHE_TTL: 600,
  MAX_LOCATION_CACHE_SIZE: 1000,
};

// Dispatch Service
export const DISPATCH = {
  MATCH_RADIUS_KM: 50,
  MAX_CONCURRENT_DISPATCHES: 5,
};

// Discovery Routes
export const DISCOVERY = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

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
};

/**
 * Shared validator hook for zValidator to ensure consistent error responses.
 */
export const validatorHook = (result: any, c: any) => {
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
