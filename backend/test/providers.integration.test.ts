import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSearchProviders, mockFindProvidersByH3Indexes } = vi.hoisted(
  () => ({
    mockSearchProviders: vi.fn(),
    mockFindProvidersByH3Indexes: vi.fn(),
  }),
);

vi.mock("../src/infrastructure/upstash", () => ({
  UpstashRedisRepository: vi.fn().mockImplementation(function () {
    return {
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

vi.mock("../src/infrastructure/mapbox", () => ({
  MapboxRepository: vi.fn().mockImplementation(function () {
    return {
      getDistanceMatrix: vi.fn(),
      getDirections: vi.fn(),
    };
  }),
}));

vi.mock("../src/infrastructure/supabase", () => {
  const makeRepo = vi.fn().mockImplementation(function () {
    return {
      searchProviders: mockSearchProviders,
      findProvidersByH3Indexes: mockFindProvidersByH3Indexes,
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      assignAmbulance: vi.fn(),
      updateBookingStatus: vi.fn(),
      getUserBookings: vi.fn(),
      getConfirmedBookings: vi.fn(),
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
      searchHospitals: vi.fn(),
      findHospitalsByH3Indexes: vi.fn(),
      broadcastTripLocation: vi.fn(),
    };
  });
  return {
    SupabaseRepository: makeRepo,
    BookingRepository: makeRepo,
    AmbulanceRepository: makeRepo,
    ProviderRepository: makeRepo,
    HospitalRepository: makeRepo,
    RealtimeBroadcaster: makeRepo,
  };
});

import app from "../src/index";

describe("Providers Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchProviders.mockResolvedValue([]);
    mockFindProvidersByH3Indexes.mockResolvedValue([]);
  });

  describe("GET /providers/search", () => {
    it("should return 200 and an array for a valid search query", async () => {
      const mockProviders = [{ id: "1", name: "Rumah Sakit A" }];
      mockSearchProviders.mockResolvedValue(mockProviders);

      const res = await app.request("/providers/search?q=rumah", {}, env);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockProviders);
    });

    it("should return 200 when limit is provided", async () => {
      const res = await app.request(
        "/providers/search?q=rumah&limit=5",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("should return 400 if query is too short", async () => {
      const res = await app.request("/providers/search?q=a", {}, env);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 400 if query is missing", async () => {
      const res = await app.request("/providers/search", {}, env);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 500 if the service throws an error", async () => {
      mockSearchProviders.mockRejectedValue(new Error("DB Error"));

      const res = await app.request("/providers/search?q=rumah", {}, env);

      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "Internal server error",
      });
    });
  });

  describe("GET /providers/nearby", () => {
    it("should return 200 and an array for a valid H3 index", async () => {
      const mockProviders = [
        { id: "1", name: "Nearby Provider", latitude: -6.2, longitude: 106.8 },
      ];
      mockFindProvidersByH3Indexes.mockResolvedValue(mockProviders);

      const res = await app.request(
        "/providers/nearby?h3_index=878c106a4ffffff",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as unknown[];
      expect(data.length).toBeGreaterThan(0);
    });

    it("should return 200 with optional lat/lng", async () => {
      const res = await app.request(
        "/providers/nearby?h3_index=878c106a4ffffff&lat=-6.2&lng=106.8",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("should return 400 if h3_index is missing", async () => {
      const res = await app.request("/providers/nearby", {}, env);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 400 if h3_index is invalid", async () => {
      const res = await app.request(
        "/providers/nearby?h3_index=invalid",
        {},
        env,
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 400 if lat is invalid", async () => {
      const res = await app.request(
        "/providers/nearby?h3_index=878c106a4ffffff&lat=999",
        {},
        env,
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });
  });
});
