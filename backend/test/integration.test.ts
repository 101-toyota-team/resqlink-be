import { env } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";

// Mock the repositories
vi.mock("../src/infrastructure/upstash", () => {
  return {
    UpstashRedisRepository: vi.fn().mockImplementation(function () {
      return {
        getDriversInBucket: vi.fn().mockResolvedValue(["driver_mock_1"]),
        getDriverLocations: vi.fn().mockResolvedValue([
          { lat: -6.2, lng: 106.81 },
        ]),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

vi.mock("../src/infrastructure/google-maps", () => {
  return {
    GoogleMapsRepository: vi.fn().mockImplementation(function () {
      return {
        getDistanceMatrix: vi.fn().mockResolvedValue({
          rows: [
            {
              elements: [
                {
                  duration: { text: "8 mins" },
                  distance: { text: "2 km" },
                  status: "OK",
                },
              ],
            },
          ],
          status: "OK",
        }),
      };
    }),
  };
});

describe("Integration Tests", () => {
  it("should find nearby drivers via API", async () => {
    const res = await app.request(
      "/ambulances/nearby?h3_index=8828308281fffff&pickup=-6.2,106.8",
      {},
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { found_drivers: any[] };

    expect(body.found_drivers).toHaveLength(1);
    expect(body.found_drivers[0]).toMatchObject({
      id: "driver_mock_1",
      eta: "8 mins",
    });
  });
});
