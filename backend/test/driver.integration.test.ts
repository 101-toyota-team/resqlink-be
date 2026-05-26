import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JwtPayload } from "../src/types";

vi.mock("hono/jwt", async (importOriginal) => {
  const mod = await importOriginal<typeof import("hono/jwt")>();
  return {
    ...mod,
    verifyWithJwks: vi.fn(),
  };
});

vi.mock("../src/infrastructure/upstash", () => ({
  UpstashRedisRepository: vi.fn().mockImplementation(function () {
    return {
      getDriversInBucket: vi.fn(),
      getDriverLocation: vi.fn(),
      getDriverLocations: vi.fn(),
      updateDriverLocation: vi.fn(),
      addDriverToBucket: vi.fn(),
      removeDriverFromBucket: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn().mockResolvedValue(60),
      del: vi.fn(),
      mget: vi.fn(),
    };
  }),
}));

vi.mock("../src/infrastructure/google-maps", () => ({
  GoogleMapsRepository: vi.fn().mockImplementation(function () {
    return {
      getDistanceMatrix: vi.fn(),
      getDirections: vi.fn(),
    };
  }),
}));

vi.mock("../src/infrastructure/supabase", () => {
  const makeRepo = function () {
    return {
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      assignAmbulance: vi.fn(),
      updateBookingStatus: vi.fn(),
      getUserBookings: vi.fn(),
      getConfirmedBookings: vi.fn().mockResolvedValue([]),
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
      searchProviders: vi.fn(),
      findProvidersByH3Indexes: vi.fn(),
      searchHospitals: vi.fn(),
      findHospitalsByH3Indexes: vi.fn(),
      broadcastTripLocation: vi.fn(),
    };
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

import app from "../src/index";
import { verifyWithJwks } from "hono/jwt";

describe("Driver Integration Tests", () => {
  const driverId = "00000000-0000-0000-0000-000000000001";
  const userId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /driver/bookings", () => {
    it("should return 200 and an array of bookings for a valid driver", async () => {
      const payload: JwtPayload = { sub: driverId, role: "driver" };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      const res = await app.request(
        "/driver/bookings",
        {
          method: "GET",
          headers: { Authorization: "Bearer valid-token" },
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("should return 403 for a non-driver user", async () => {
      const payload: JwtPayload = { sub: userId, role: "authenticated" };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      const res = await app.request(
        "/driver/bookings",
        {
          method: "GET",
          headers: { Authorization: "Bearer valid-token" },
        },
        env,
      );

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({
        error: "You do not have permission to access this resource",
      });
    });

    it("should return 401 if Authorization header is missing", async () => {
      const res = await app.request("/driver/bookings", { method: "GET" }, env);

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "Unauthorized access" });
    });
  });

  describe("POST /driver/ping validation", () => {
    it("should return 400 if driver_id is missing", async () => {
      const payload: JwtPayload = { sub: driverId, role: "driver" };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      const res = await app.request(
        "/driver/ping",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            h3_index: "878c106a4ffffff",
            lat: -6.2,
            lng: 106.8,
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 400 if lat is invalid", async () => {
      const payload: JwtPayload = { sub: driverId, role: "driver" };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      const res = await app.request(
        "/driver/ping",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            driver_id: driverId,
            h3_index: "878c106a4ffffff",
            lat: 999,
            lng: 106.8,
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 400 if h3_index is invalid", async () => {
      const payload: JwtPayload = { sub: driverId, role: "driver" };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      const res = await app.request(
        "/driver/ping",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            driver_id: driverId,
            h3_index: "invalid",
            lat: -6.2,
            lng: 106.8,
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });
  });
});
