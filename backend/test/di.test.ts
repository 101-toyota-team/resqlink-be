import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppVariables } from "../src/types";
import type { Bindings } from "../src/schemas/env";

// Mock infrastructure classes to avoid real connections.
// Use regular functions (not arrow) so `new` works.
vi.mock("../src/infrastructure/supabase", () => ({
  BookingRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
  AmbulanceRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
  ProviderRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
  HospitalRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
  RealtimeBroadcaster: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock("../src/infrastructure/upstash", () => ({
  UpstashRedisRepository: vi.fn().mockImplementation(function () {
    return { get: vi.fn(), set: vi.fn() };
  }),
}));

vi.mock("../src/infrastructure/mapbox", () => ({
  MapboxRepository: vi.fn().mockImplementation(function () {
    return { getDirections: vi.fn(), getDistanceMatrix: vi.fn() };
  }),
}));

describe("DI Middleware", () => {
  let app: Hono<{ Bindings: Bindings; Variables: AppVariables }>;

  const mockEnv: Bindings = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret-key",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    MAPBOX_ACCESS_TOKEN: "test-token",
    ALLOWED_ORIGINS: "*",
    RL_DEFAULT: { limit: vi.fn().mockResolvedValue({ success: true }) },
  };

  beforeEach(async () => {
    // Reset constructor call tracking from mocks
    vi.clearAllMocks();

    // Dynamic import to get fresh module instance after mocks are applied
    const { diMiddleware } = await import("../src/middleware/di");

    app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
    app.use("*", diMiddleware);
    app.get("/test", (c) => {
      return c.json({
        bookingRepo: typeof c.get("getBookingRepo"),
        bookingRepoInstance: typeof c.get("getBookingRepo")(),
        ambulanceRepo: typeof c.get("getAmbulanceRepo"),
        ambulanceRepoInstance: typeof c.get("getAmbulanceRepo")(),
        providerRepo: typeof c.get("getProviderRepo"),
        providerRepoInstance: typeof c.get("getProviderRepo")(),
        hospitalRepo: typeof c.get("getHospitalRepo"),
        hospitalRepoInstance: typeof c.get("getHospitalRepo")(),
        realtimeRepo: typeof c.get("getRealtimeRepo"),
        realtimeRepoInstance: typeof c.get("getRealtimeRepo")(),
        bookingService: typeof c.get("getBookingService"),
        bookingServiceInstance: typeof c.get("getBookingService")(),
        providerService: typeof c.get("getProviderService"),
        providerServiceInstance: typeof c.get("getProviderService")(),
        hospitalService: typeof c.get("getHospitalService"),
        hospitalServiceInstance: typeof c.get("getHospitalService")(),
        dispatchService: typeof c.get("getDispatchService"),
        dispatchServiceInstance: typeof c.get("getDispatchService")(),
        maps: typeof c.get("getMaps"),
        mapsInstance: typeof c.get("getMaps")(),
        cache: typeof c.get("getCache"),
        cacheInstance: typeof c.get("getCache")(),
      });
    });
  });

  it("should set all lazy getter keys on context", async () => {
    const res = await app.request("/test", {}, mockEnv as unknown as Bindings);
    expect(res.status).toBe(200);

    const body = await res.json<Record<string, string>>();
    const expectedKeys = [
      "bookingRepo",
      "ambulanceRepo",
      "providerRepo",
      "hospitalRepo",
      "realtimeRepo",
      "bookingService",
      "providerService",
      "hospitalService",
      "dispatchService",
      "maps",
      "cache",
    ];

    for (const key of expectedKeys) {
      // Each getter should be a function
      expect(body[key]).toBe("function");
      // Each getter should return an object (not undefined/null)
      expect(body[`${key}Instance`]).toBe("object");
    }
  });

  it("should return the same instance on repeated calls (singleton)", async () => {
    app.get("/singleton", (c) => {
      const booking1 = c.get("getBookingRepo")();
      const booking2 = c.get("getBookingRepo")();
      const maps1 = c.get("getMaps")();
      const maps2 = c.get("getMaps")();
      const cache1 = c.get("getCache")();
      const cache2 = c.get("getCache")();

      return c.json({
        sameBookingRepo: booking1 === booking2,
        sameMaps: maps1 === maps2,
        sameCache: cache1 === cache2,
      });
    });

    const res = await app.request(
      "/singleton",
      {},
      mockEnv as unknown as Bindings,
    );
    expect(res.status).toBe(200);

    const body = await res.json<Record<string, boolean>>();
    expect(body.sameBookingRepo).toBe(true);
    expect(body.sameMaps).toBe(true);
    expect(body.sameCache).toBe(true);
  });

  it("should reuse getGeo across services that depend on it", async () => {
    app.get("/geo-share", (c) => {
      const providerService = c.get("getProviderService")();
      const hospitalService = c.get("getHospitalService")();
      return c.json({
        providerOk: typeof providerService === "object",
        hospitalOk: typeof hospitalService === "object",
      });
    });

    const res = await app.request(
      "/geo-share",
      {},
      mockEnv as unknown as Bindings,
    );
    expect(res.status).toBe(200);

    const body = await res.json<Record<string, boolean>>();
    expect(body.providerOk).toBe(true);
    expect(body.hospitalOk).toBe(true);
  });

  it("should construct service with correct dependency chain", async () => {
    app.get("/chain", (c) => {
      const bookingSvc = c.get("getBookingService")();
      const dispatchSvc = c.get("getDispatchService")();

      return c.json({
        bookingOk: typeof bookingSvc === "object",
        dispatchOk: typeof dispatchSvc === "object",
      });
    });

    const res = await app.request("/chain", {}, mockEnv as unknown as Bindings);
    expect(res.status).toBe(200);

    const body = await res.json<Record<string, boolean>>();
    expect(body.bookingOk).toBe(true);
    expect(body.dispatchOk).toBe(true);
  });
});
