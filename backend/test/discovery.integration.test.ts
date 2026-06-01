import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnv = {
  ...env,
  ALLOWED_ORIGINS: "*",
  UPSTASH_REDIS_REST_URL: "http://localhost",
  UPSTASH_REDIS_REST_TOKEN: "test",
  SUPABASE_URL: "http://localhost",
  SUPABASE_SECRET_KEY: "test",
  MAPBOX_ACCESS_TOKEN: "test",
};

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
      mget: vi.fn().mockResolvedValue([]),
    };
  }),
}));

vi.mock("../src/infrastructure/mapbox", () => ({
  MapboxRepository: vi.fn().mockImplementation(function () {
    return {
      getDistanceMatrix: vi.fn().mockResolvedValue({
        rows: [
          {
            elements: [
              {
                status: "OK",
                duration: { text: "5 mins", value: 300 },
                distance: { text: "1.2 km", value: 1200 },
              },
            ],
          },
        ],
        status: "OK",
      }),
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
      getConfirmedBookings: vi.fn(),
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn().mockResolvedValue([]),
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
import { AmbulanceRepository } from "../src/infrastructure/supabase";
import { UpstashRedisRepository } from "../src/infrastructure/upstash";

describe("Discovery Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Happy path: GET /ambulances/nearby?h3_index=878c106a4ffffff with valid H3 index", async () => {
    const mockDrivers = [{ id: "driver_1", lat: -6.2, lng: 106.8 }];
    vi.mocked(AmbulanceRepository).mockImplementation(function () {
      return {
        getAmbulance: vi.fn(),
        findAvailableAmbulances: vi.fn().mockResolvedValue(mockDrivers),
        getAmbulanceProviderLocation: vi.fn(),
      };
    });

    const res = await app.request(
      "/ambulances/nearby?h3_index=878c106a4ffffff",
      {},
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      center: "878c106a4ffffff",
      found_drivers: mockDrivers,
    });
  });

  it("With pickup param: GET /ambulances/nearby?h3_index=878c106a4ffffff&pickup=-6.2,106.8", async () => {
    const mockDrivers = [{ id: "driver_1", lat: -6.2, lng: 106.8 }];
    vi.mocked(AmbulanceRepository).mockImplementation(function () {
      return {
        getAmbulance: vi.fn(),
        findAvailableAmbulances: vi.fn().mockResolvedValue(mockDrivers),
        getAmbulanceProviderLocation: vi.fn(),
      };
    });

    vi.mocked(UpstashRedisRepository).mockImplementation(function () {
      return {
        getDriversInBucket: vi.fn(),
        updateDriverLocation: vi.fn(),
        getDriverLocation: vi.fn(),
        getDriverLocations: vi.fn(),
        addDriverToBucket: vi.fn(),
        removeDriverFromBucket: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        mget: vi.fn().mockResolvedValue([null]),
        del: vi.fn(),
        incr: vi.fn(),
        expire: vi.fn(),
        ttl: vi.fn(),
      };
    });

    const res = await app.request(
      "/ambulances/nearby?h3_index=878c106a4ffffff&pickup=-6.2,106.8",
      {},
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      center: "878c106a4ffffff",
      found_drivers: [
        {
          id: "driver_1",
          lat: -6.2,
          lng: 106.8,
          eta: "5 mins",
          distance: "1.2 km",
          eta_value: 300,
          distance_value: 1200,
        },
      ],
    });
  });

  it("Missing h3_index: GET /ambulances/nearby", async () => {
    const res = await app.request("/ambulances/nearby", {}, mockEnv);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Validation failed" });
  });

  it("Invalid H3 index: GET /ambulances/nearby?h3_index=invalid", async () => {
    const res = await app.request(
      "/ambulances/nearby?h3_index=invalid",
      {},
      mockEnv,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Validation failed" });
  });

  it("Invalid pickup format: GET /ambulances/nearby?h3_index=878c106a4ffffff&pickup=not-a-coord", async () => {
    const res = await app.request(
      "/ambulances/nearby?h3_index=878c106a4ffffff&pickup=not-a-coord",
      {},
      mockEnv,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Validation failed" });
  });

  it("Service error: GET /ambulances/nearby?h3_index=878c106a4ffffff (when dispatch service throws)", async () => {
    vi.mocked(AmbulanceRepository).mockImplementation(function () {
      return {
        getAmbulance: vi.fn(),
        findAvailableAmbulances: vi
          .fn()
          .mockRejectedValue(new Error("DB Error")),
        getAmbulanceProviderLocation: vi.fn(),
      };
    });

    const res = await app.request(
      "/ambulances/nearby?h3_index=878c106a4ffffff",
      {},
      mockEnv,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Internal server error" });
  });
});
