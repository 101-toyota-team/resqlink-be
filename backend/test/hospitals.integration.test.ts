import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";

const mockSearchHospitals = vi.fn().mockResolvedValue([]);
const mockFindHospitalsByH3Indexes = vi.fn().mockResolvedValue([]);

vi.mock("../src/infrastructure/upstash", () => ({
  UpstashRedisRepository: vi.fn().mockImplementation(function () {
    return {
      get: vi.fn(),
      set: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn().mockResolvedValue(60),
      del: vi.fn(),
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
      searchHospitals: mockSearchHospitals,
      findHospitalsByH3Indexes: mockFindHospitalsByH3Indexes,
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

describe("Hospitals Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchHospitals.mockResolvedValue([]);
    mockFindHospitalsByH3Indexes.mockResolvedValue([]);
  });

  describe("GET /hospitals/search", () => {
    it("should return 200 and an array of hospitals for a valid query", async () => {
      const res = await app.request(
        "/hospitals/search?q=rumah",
        { method: "GET" },
        env,
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("should return 400 if query is too short", async () => {
      const res = await app.request(
        "/hospitals/search?q=a",
        { method: "GET" },
        env,
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 400 if query is missing", async () => {
      const res = await app.request(
        "/hospitals/search",
        { method: "GET" },
        env,
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 500 if the service throws an error", async () => {
      mockSearchHospitals.mockRejectedValueOnce(new Error("Database error"));

      const res = await app.request(
        "/hospitals/search?q=rumah",
        { method: "GET" },
        env,
      );
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "Internal server error",
      });
    });
  });

  describe("GET /hospitals/nearby", () => {
    it("should return 200 and an array of hospitals for a valid H3 index", async () => {
      const res = await app.request(
        "/hospitals/nearby?h3_index=878c106a4ffffff",
        { method: "GET" },
        env,
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("should return 400 if h3_index is missing", async () => {
      const res = await app.request(
        "/hospitals/nearby",
        { method: "GET" },
        env,
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });

    it("should return 400 if h3_index is invalid", async () => {
      const res = await app.request(
        "/hospitals/nearby?h3_index=invalid",
        { method: "GET" },
        env,
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Validation failed" });
    });
  });
});
