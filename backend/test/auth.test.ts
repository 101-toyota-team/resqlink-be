import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JwtPayload } from "../src/types";
import {
  isDriverRole,
  canAccessBooking,
  getRoleFromMetadata,
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

vi.mock("../src/infrastructure/supabase", () => ({
  SupabaseRepository: vi.fn().mockImplementation(function () {
    return {
      createBooking: vi
        .fn()
        .mockResolvedValue({ id: "booking_123", status: "confirmed" }),
    };
  }),
}));

import app from "../src/index";
import { verifyWithJwks } from "hono/jwt";

describe("Authentication & Authorization", () => {
  const driverId = "00000000-0000-0000-0000-000000000001";
  const riderId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if Authorization header is missing on protected route", async () => {
    const res = await app.request("/bookings", { method: "POST" }, env);
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
      env,
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
      env,
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
      env,
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
      role: "driver",
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
      env,
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
      role: "driver",
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
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("isDriverRole", () => {
  it("returns true when payload.role is driver", () => {
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

  it("allows driver users", () => {
    expect(canAccessBooking({ sub: "abc", role: "driver" }, "xyz")).toBe(true);
  });

  it("denies unrelated non-driver", () => {
    expect(canAccessBooking({ sub: "abc", role: "user" }, "xyz")).toBe(false);
  });

  it("handles undefined booking user id", () => {
    expect(canAccessBooking({ sub: "abc", role: "user" }, undefined)).toBe(
      false,
    );
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
