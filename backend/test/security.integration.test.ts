import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("hono/jwt", async (importOriginal) => {
  const mod = await importOriginal<typeof import("hono/jwt")>();
  return {
    ...mod,
    verifyWithJwks: vi.fn(),
  };
});

const mockBookingRepo = {
  createBooking: vi.fn(),
  getBooking: vi.fn(),
  assignAmbulance: vi.fn(),
  updateBookingStatus: vi.fn(),
  getUserBookings: vi.fn(),
  getConfirmedBookings: vi.fn(),
  getAmbulance: vi.fn(),
  findAvailableAmbulances: vi.fn(),
  getAmbulanceProviderLocation: vi.fn(),
  searchProviders: vi.fn(),
  findProvidersByH3Indexes: vi.fn(),
  searchHospitals: vi.fn(),
  findHospitalsByH3Indexes: vi.fn(),
  broadcastTripLocation: vi.fn(),
};

vi.mock("../src/infrastructure/supabase", () => {
  const makeRepo = function () {
    return mockBookingRepo;
  };
  return {
    SupabaseRepository: vi.fn().mockImplementation(makeRepo),
    BookingRepository: vi.fn().mockImplementation(makeRepo),
    AmbulanceRepository: vi.fn().mockImplementation(makeRepo),
    ProviderRepository: vi.fn().mockImplementation(makeRepo),
    HospitalRepository: vi.fn().mockImplementation(makeRepo),
    RealtimeBroadcaster: vi.fn().mockImplementation(makeRepo),
  };
});

vi.mock("../src/infrastructure/upstash", () => ({
  UpstashRedisRepository: vi.fn().mockImplementation(function () {
    return {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };
  }),
}));

vi.mock("../src/infrastructure/mapbox", () => ({
  MapboxRepository: vi.fn().mockImplementation(function () {
    return {
      getDirections: vi.fn(),
      getDistanceMatrix: vi.fn(),
    };
  }),
}));

import app from "../src/index";

const testEnv = {
  ...env,
  UPSTASH_REDIS_REST_URL: "https://example.com",
  UPSTASH_REDIS_REST_TOKEN: "token",
  SUPABASE_URL: "https://example.com",
  SUPABASE_SECRET_KEY: "key",
  MAPBOX_ACCESS_TOKEN: "token",
  ALLOWED_ORIGINS: "*",
};

describe("Security Integration Tests", () => {
  const bookingId = "00000000-0000-0000-0000-000000000004";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Unauthenticated Access", () => {
    it("should return 401 when accessing /bookings without a token", async () => {
      const res = await app.request(
        `/bookings/${bookingId}`,
        { method: "GET" },
        testEnv,
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({ error: "Unauthorized access" });
    });
  });
});
