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
import type { JwtPayload } from "../src/types";
import {
  isDriverRole,
  isProviderRole,
  isAdminRole,
  canAccessBooking,
  getRoleFromMetadata,
  getProviderId,
} from "../src/utils/auth";

// ALL MOCKS AT THE TOP
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

vi.mock("../src/infrastructure/mapbox", () => ({
  MapboxRepository: vi.fn().mockImplementation(function () {
    return {
      getDistanceMatrix: vi.fn(),
      getDirections: vi.fn(),
    };
  }),
}));

vi.mock("../src/infrastructure/supabase", () => {
  const makeRepo = function () {
    return {
      createBooking: vi
        .fn()
        .mockResolvedValue({ id: "booking_123", status: "confirmed" }),
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

describe("Authentication & Authorization", () => {
  const driverId = "00000000-0000-0000-0000-000000000001";
  const riderId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if Authorization header is missing on protected route", async () => {
    const res = await app.request("/bookings", { method: "POST" }, mockEnv);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized access" });
  });

  it("should return 401 if token is invalid", async () => {
    vi.mocked(verifyWithJwks).mockRejectedValue(new Error("Invalid token"));

    const res = await app.request(
      "/bookings",
      {
        method: "POST",
        headers: { Authorization: "Bearer invalid-token" },
      },
      mockEnv,
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Invalid token" });
  });

  it("should allow access to bookings if token is valid", async () => {
    const payload: JwtPayload = { sub: riderId };
    vi.mocked(verifyWithJwks).mockResolvedValue(payload);

    const res = await app.request(
      "/bookings",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ambulance_id: "00000000-0000-0000-0000-000000000003",
          booking_type: "medical",
          pickup_lat: -6.2,
          pickup_lng: 106.8,
          pickup_h3: "878c106a4ffffff",
          destination_address: "General Hospital",
          destination_lat: -6.21,
          destination_lng: 106.81,
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: "booking_123",
      status: "confirmed",
    });
  });

  it("should return 403 if user is not a driver on driver endpoints", async () => {
    const payload: JwtPayload = {
      sub: riderId,
      role: "authenticated",
    };
    vi.mocked(verifyWithJwks).mockResolvedValue(payload);

    const res = await app.request(
      "/driver/ping",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-rider-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driver_id: riderId,
          h3_index: "878c106a4ffffff",
          lat: -6.2,
          lng: 106.8,
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "You do not have permission to access this resource",
      details: {},
    });
  });

  it("should return 403 if driver_id in body does not match sub in JWT", async () => {
    const payload: JwtPayload = {
      sub: driverId,
      app_metadata: { role: "driver" },
    };
    vi.mocked(verifyWithJwks).mockResolvedValue(payload);

    const res = await app.request(
      "/driver/ping",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-driver-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driver_id: "00000000-0000-0000-0000-000000000004",
          h3_index: "878c106a4ffffff",
          lat: -6.2,
          lng: 106.8,
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "You do not have permission to access this resource",
      details: {},
    });
  });

  it("should allow driver ping if authenticated as driver with matching ID", async () => {
    const payload: JwtPayload = {
      sub: driverId,
      app_metadata: { role: "driver" },
    };
    vi.mocked(verifyWithJwks).mockResolvedValue(payload);

    const res = await app.request(
      "/driver/ping",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-driver-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driver_id: driverId,
          h3_index: "878c106a4ffffff",
          lat: -6.2,
          lng: 106.8,
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      driver_id: driverId,
      h3_index: "878c106a4ffffff",
      lat: -6.2,
      lng: 106.8,
    });
  });
});

describe("isDriverRole", () => {
  it("returns true when payload.role is driver even if app_metadata is missing", () => {
    expect(isDriverRole({ sub: "abc", role: "driver" })).toBe(true);
  });

  it("returns true when app_metadata.role is driver", () => {
    expect(
      isDriverRole({
        sub: "abc",
        role: "user",
        app_metadata: { role: "driver" },
      }),
    ).toBe(true);
  });

  it("returns false when no driver role present", () => {
    expect(isDriverRole({ sub: "abc", role: "user" })).toBe(false);
  });

  it("returns false when role is missing", () => {
    expect(isDriverRole({ sub: "abc" })).toBe(false);
  });
});

describe("canAccessBooking", () => {
  it("allows booking owner", () => {
    expect(canAccessBooking({ sub: "abc" }, "abc")).toBe(true);
  });

  it("denies driver access if driver_id does not match sub", () => {
    expect(
      canAccessBooking(
        { sub: "driver-1", app_metadata: { role: "driver" } },
        "user-1",
        "prov-1",
        "driver-2",
      ),
    ).toBe(false);
  });

  it("allows driver access if driver_id matches sub", () => {
    expect(
      canAccessBooking(
        { sub: "driver-1", app_metadata: { role: "driver" } },
        "user-1",
        "prov-1",
        "driver-1",
      ),
    ).toBe(true);
  });

  it("denies driver access based on provider_id (strict isolation)", () => {
    expect(
      canAccessBooking(
        {
          sub: "driver-1",
          app_metadata: { role: "driver", provider_id: "prov-123" },
        },
        "user-1",
        "prov-123",
        "driver-2",
      ),
    ).toBe(false);
  });

  it("allows admin access to any booking", () => {
    expect(
      canAccessBooking(
        { sub: "admin-1", app_metadata: { role: "admin" } },
        "user-1",
        "prov-1",
      ),
    ).toBe(true);
  });

  it("denies access if both booking user id and sub are undefined", () => {
    expect(
      canAccessBooking({ role: "user" } as unknown as JwtPayload, undefined),
    ).toBe(false);
  });

  it("denies unrelated non-driver", () => {
    expect(canAccessBooking({ sub: "abc", role: "user" }, "xyz")).toBe(false);
  });

  it("handles undefined booking user id", () => {
    expect(canAccessBooking({ sub: "abc", role: "user" }, undefined)).toBe(
      false,
    );
  });

  it("allows provider with matching provider_id", () => {
    expect(
      canAccessBooking(
        {
          sub: "abc",
          app_metadata: { role: "provider", provider_id: "prov-123" },
        },
        "other-user",
        "prov-123",
      ),
    ).toBe(true);
  });

  it("denies provider with non-matching provider_id", () => {
    expect(
      canAccessBooking(
        {
          sub: "abc",
          app_metadata: { role: "provider", provider_id: "prov-123" },
        },
        "other-user",
        "prov-999",
      ),
    ).toBe(false);
  });

  it("denies provider when booking has no provider_id", () => {
    expect(
      canAccessBooking(
        {
          sub: "abc",
          app_metadata: { role: "provider", provider_id: "prov-123" },
        },
        "other-user",
        undefined,
      ),
    ).toBe(false);
  });
});

describe("getRoleFromMetadata", () => {
  it("extracts role from metadata object", () => {
    expect(getRoleFromMetadata({ role: "driver" })).toBe("driver");
  });

  it("returns undefined for null metadata", () => {
    expect(getRoleFromMetadata(null)).toBeUndefined();
  });

  it("returns undefined for non-object metadata", () => {
    expect(getRoleFromMetadata("string")).toBeUndefined();
  });

  it("returns undefined when role is not a string", () => {
    expect(getRoleFromMetadata({ role: 123 })).toBeUndefined();
  });
});

describe("isProviderRole", () => {
  it("returns true when app_metadata.role is provider", () => {
    expect(
      isProviderRole({
        sub: "abc",
        app_metadata: { role: "provider" },
      }),
    ).toBe(true);
  });

  it("returns true when payload.role is provider even if app_metadata is missing", () => {
    expect(isProviderRole({ sub: "abc", role: "provider" })).toBe(true);
  });

  it("returns false when no provider role present", () => {
    expect(isProviderRole({ sub: "abc", role: "user" })).toBe(false);
  });

  it("returns false when role is missing", () => {
    expect(isProviderRole({ sub: "abc" })).toBe(false);
  });
});

describe("isAdminRole", () => {
  it("returns true when app_metadata.role is admin", () => {
    expect(
      isAdminRole({
        sub: "abc",
        app_metadata: { role: "admin" },
      }),
    ).toBe(true);
  });

  it("returns true when payload.role is admin", () => {
    expect(isAdminRole({ sub: "abc", role: "admin" })).toBe(true);
  });

  it("returns false when no admin role present", () => {
    expect(isAdminRole({ sub: "abc", role: "user" })).toBe(false);
  });
});

describe("getProviderId", () => {
  it("extracts provider_id from app_metadata", () => {
    expect(
      getProviderId({
        sub: "abc",
        app_metadata: { provider_id: "prov-123" },
      }),
    ).toBe("prov-123");
  });

  it("returns provider_id when it is in payload directly", () => {
    expect(
      getProviderId({
        sub: "abc",
        provider_id: "prov-456",
      }),
    ).toBe("prov-456");
  });

  it("returns undefined when provider_id is missing", () => {
    expect(getProviderId({ sub: "abc" })).toBeUndefined();
  });

  it("returns undefined when app_metadata is null", () => {
    expect(
      getProviderId({ sub: "abc", app_metadata: null as unknown as undefined }),
    ).toBeUndefined();
  });

  it("returns undefined when app_metadata.provider_id is not a string", () => {
    expect(
      getProviderId({
        sub: "abc",
        app_metadata: { provider_id: 12345 },
      } as unknown as JwtPayload),
    ).toBeUndefined();
  });
});
