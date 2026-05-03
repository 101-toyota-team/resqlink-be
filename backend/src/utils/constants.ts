// Configuration constants for backend services

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

// Google Maps API
export const GOOGLE_MAPS = {
  MAX_ROUTE_POINTS: 25,
  MAX_WAYPOINTS: 23,
};

// Dispatch Service
export const DISPATCH = {
  MATCH_RADIUS_KM: 50,
  MAX_CONCURRENT_DISPATCHES: 5,
  DISPATCH_TIMEOUT_MS: 30000,
};

// Discovery Routes
export const DISCOVERY = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// HTTP
export const HTTP = {
  REQUEST_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
};

// Error messages
export const ERROR_MESSAGES = {
  INVALID_COORDINATES: 'Invalid coordinates provided',
  DISPATCH_TIMEOUT: 'Dispatch request timed out',
  BOOKING_FAILED: 'Failed to create booking',
  DISCOVERY_FAILED: 'Failed to retrieve drivers',
  HOSPITALS_FAILED: 'Failed to retrieve hospitals',
  UNAUTHORIZED: 'Unauthorized access',
  INTERNAL_ERROR: 'Internal server error',
};
