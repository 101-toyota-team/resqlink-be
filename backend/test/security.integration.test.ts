import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JwtPayload } from "../src/types";
import { ERROR_MESSAGES } from "../src/utils/constants";

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
import { verifyWithJwks } from "hono/jwt";

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
  const driverAId = "00000000-0000-0000-0000-000000000001";
  const driverBId = "00000000-0000-0000-0000-000000000002";
  const userId = "00000000-0000-0000-0000-000000000003";
  const bookingId = "00000000-0000-0000-0000-000000000004";
  const providerId = "00000000-0000-0000-0000-000000000005";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cross-Driver Access", () => {
    it("should return 403 when Driver A attempts to access Booking B assigned to Driver B", async () => {
      // Mock Driver A token
      const payload: JwtPayload = {
        sub: driverAId,
        app_metadata: { role: "driver" },
      };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      // Mock Booking assigned to Driver B
      mockBookingRepo.getBooking.mockResolvedValue({
        id: bookingId,
        user_id: userId,
        driver_id: driverBId,
        status: "confirmed",
      });

      const res = await app.request(
        `/bookings/${bookingId}`,
        {
          method: "GET",
          headers: { Authorization: "Bearer driver-a-token" },
        },
        testEnv,
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toMatchObject({
        error: ERROR_MESSAGES.FORBIDDEN_ACCESS,
      });
    });

    it("should return 403 when Driver A attempts to update status of Booking B assigned to Driver B", async () => {
      // Mock Driver A token
      const payload: JwtPayload = {
        sub: driverAId,
        app_metadata: { role: "driver" },
      };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      // Mock Booking assigned to Driver B
      mockBookingRepo.getBooking.mockResolvedValue({
        id: bookingId,
        user_id: userId,
        driver_id: driverBId,
        status: "confirmed",
      });

      const res = await app.request(
        `/bookings/${bookingId}/status`,
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer driver-a-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "en_route" }),
        },
        testEnv,
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toMatchObject({
        error: ERROR_MESSAGES.FORBIDDEN_ACCESS,
      });
    });
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

    it("should return 401 when accessing /driver/bookings without a token", async () => {
      const res = await app.request(
        "/driver/bookings",
        { method: "GET" },
        testEnv,
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({ error: "Unauthorized access" });
    });
  });

  describe("Driver Isolation", () => {
    it("should only return bookings assigned to the authenticated driver", async () => {
      const payload: JwtPayload = {
        sub: driverAId,
        app_metadata: { role: "driver", provider_id: providerId },
      };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      const mockBookings = [{ id: "b1", driver_id: driverAId }];
      mockBookingRepo.getConfirmedBookings.mockResolvedValue(mockBookings);

      const res = await app.request(
        "/driver/bookings",
        {
          method: "GET",
          headers: { Authorization: "Bearer driver-a-token" },
        },
        testEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(mockBookings);

      // Verify repository was called with the correct driver ID
      expect(mockBookingRepo.getConfirmedBookings).toHaveBeenCalledWith(
        providerId,
        driverAId,
      );
    });

    it("should return 403 when a regular user attempts to access driver routes", async () => {
      const payload: JwtPayload = {
        sub: userId,
        role: "authenticated",
      };
      vi.mocked(verifyWithJwks).mockResolvedValue(payload);

      const res = await app.request(
        "/driver/bookings",
        {
          method: "GET",
          headers: { Authorization: "Bearer user-token" },
        },
        testEnv,
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toMatchObject({
        error: ERROR_MESSAGES.FORBIDDEN_ACCESS,
      });
    });
  });
});
