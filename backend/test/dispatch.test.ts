import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { DispatchService } from "../src/services/dispatch";
import { ICacheRepository } from "../src/repositories/cache";
import { GoogleMapsRepository } from "../src/infrastructure/google-maps";

describe("DispatchService", () => {
  let mockCache: Mocked<ICacheRepository>;
  let mockMaps: Mocked<GoogleMapsRepository>;
  let service: DispatchService;

  beforeEach(() => {
    mockCache = {
      getDriversInBucket: vi.fn(),
      updateDriverLocation: vi.fn(),
      getDriverLocation: vi.fn(),
      getDriverLocations: vi.fn(),
      addDriverToBucket: vi.fn(),
      removeDriverFromBucket: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    } as any;
    mockMaps = {
      getDistanceMatrix: vi.fn(),
      getDirections: vi.fn(),
      searchPlaces: vi.fn(),
    } as any;
    service = new DispatchService(mockCache, mockMaps);
  });

  it("should find nearby drivers and enrich with ETA if pickupLocation is provided", async () => {
    // 1. Setup mocks
    mockCache.get.mockResolvedValue(null);
    mockCache.getDriversInBucket.mockResolvedValue(["driver_1"]);
    mockCache.getDriverLocations.mockResolvedValue([
      { lat: -6.1, lng: 106.8 },
    ]);

    mockMaps.getDistanceMatrix.mockResolvedValue({
      rows: [
        {
          elements: [
            {
              duration: { text: "5 mins", value: 300 },
              distance: { text: "1.2 km", value: 1200 },
              status: "OK",
            },
          ],
        },
      ],
      status: "OK",
    });

    // 2. Execute
    const results = await service.findNearbyDrivers(
      "8828308281fffff",
      1,
      "-6.12,106.85",
    );

    // 3. Assert
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "driver_1",
      eta: "5 mins",
      distance: "1.2 km",
    });

    expect(mockCache.getDriversInBucket).toHaveBeenCalled();
    expect(mockCache.getDriverLocations).toHaveBeenCalledWith(["driver_1"]);
    expect(mockMaps.getDistanceMatrix).toHaveBeenCalledWith(
      ["-6.1,106.8"],
      ["-6.12,106.85"],
    );
  });
});
