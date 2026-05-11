import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { DispatchService } from "../src/services/dispatch";
import { ICacheRepository } from "../src/repositories/cache";
import { IGeoService } from "../src/services/geo";
import { IDistanceService } from "../src/services/distance";
import { DriverDetails } from "../src/types";

describe("DispatchService", () => {
  let mockCache: Mocked<ICacheRepository>;
  let mockGeo: Mocked<IGeoService>;
  let mockDistance: Mocked<IDistanceService>;
  let service: DispatchService;

  beforeEach(() => {
    mockCache = {
      getDriversInBucket: vi.fn(),
      getDriverLocations: vi.fn(),
      updateDriverLocation: vi.fn(),
      addDriverToBucket: vi.fn(),
      removeDriverFromBucket: vi.fn(),
      getDriverLocation: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
    } as Mocked<ICacheRepository>;
    mockGeo = {
      parseLatLng: vi.fn(),
      latLngToCell: vi.fn(),
      getNeighbors: vi.fn(),
    } as Mocked<IGeoService>;
    mockDistance = {
      getEnrichedDrivers: vi.fn(),
    } as Mocked<IDistanceService>;
    service = new DispatchService(mockCache, mockGeo, mockDistance);
  });

  it("should find nearby drivers and call distance service for enrichment", async () => {
    mockGeo.getNeighbors.mockReturnValue(["8828308281fffff"]);
    mockCache.getDriversInBucket.mockResolvedValue(["driver_1"]);
    mockCache.getDriverLocations.mockResolvedValue([{ lat: -6.1, lng: 106.8 }]);
    mockDistance.getEnrichedDrivers.mockResolvedValue([
      {
        id: "driver_1",
        lat: -6.1,
        lng: 106.8,
        eta: "5 mins",
        distance: "1.2 km",
      } as DriverDetails & { eta: string; distance: string },
    ]);

    const results = await service.findNearbyDrivers(
      "8828308281fffff",
      1,
      "-6.12,106.85",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "driver_1",
      eta: "5 mins",
    });

    expect(mockGeo.getNeighbors).toHaveBeenCalledWith("8828308281fffff", 1);
    expect(mockDistance.getEnrichedDrivers).toHaveBeenCalled();
  });
});