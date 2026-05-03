import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ALL MOCKS AT THE TOP
vi.mock("hono/jwt", async (importOriginal) => {
  const mod = await importOriginal<any>();
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
    };
  }),
}));

vi.mock("../src/infrastructure/google-maps", () => ({
  GoogleMapsRepository: vi.fn().mockImplementation(function () {
    return {
      getDistanceMatrix: vi.fn(),
      searchPlaces: vi.fn(),
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
    expect(await res.json()).toEqual({ error: "Unauthorized" });
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
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("should allow access to bookings if token is valid", async () => {
    vi.mocked(verifyWithJwks).mockResolvedValue({ sub: riderId } as any);

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
          pickup_h3: "8828308281fffff",
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
    vi.mocked(verifyWithJwks).mockResolvedValue({
      sub: riderId,
      role: "authenticated",
    } as any);

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
          h3_index: "8828308281fffff",
          lat: -6.2,
          lng: 106.8,
        }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Unauthorized driver" });
  });

  it("should return 403 if driver_id in body does not match sub in JWT", async () => {
    vi.mocked(verifyWithJwks).mockResolvedValue({
      sub: driverId,
      role: "driver",
    } as any);

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
          h3_index: "8828308281fffff",
          lat: -6.2,
          lng: 106.8,
        }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Unauthorized driver" });
  });

  it("should allow driver ping if authenticated as driver with matching ID", async () => {
    vi.mocked(verifyWithJwks).mockResolvedValue({
      sub: driverId,
      role: "driver",
    } as any);

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
          h3_index: "8828308281fffff",
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
