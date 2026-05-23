import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { DispatchService } from "../src/services/dispatch";
import { ICacheRepository } from "../src/repositories/cache";
import { IAmbulanceRepository } from "../src/repositories/ambulance";
import { IGeoService } from "../src/services/geo";
import { IDistanceService } from "../src/services/distance";
import { ISimulationService } from "../src/services/simulation";
import { AmbulanceLocation } from "../src/types";

describe("DispatchService", () => {
  let mockCache: Mocked<ICacheRepository>;
  let mockAmbulanceRepo: Mocked<IAmbulanceRepository>;
  let mockGeo: Mocked<IGeoService>;
  let mockDistance: Mocked<IDistanceService>;
  let mockSimulation: Mocked<ISimulationService>;
  let service: DispatchService;

  beforeEach(() => {
    mockCache = {
      set: vi.fn(),
      get: vi.fn(),
      mget: vi.fn(),
      getDriversInBucket: vi.fn(),
      updateDriverLocation: vi.fn(),
      getDriverLocation: vi.fn(),
      getDriverLocations: vi.fn(),
      addDriverToBucket: vi.fn(),
      removeDriverFromBucket: vi.fn(),
      expire: vi.fn(),
      incr: vi.fn(),
      del: vi.fn(),
    } as Mocked<ICacheRepository>;
    mockAmbulanceRepo = {
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
    } as Mocked<IAmbulanceRepository>;
    mockGeo = {
      parseLatLng: vi.fn(),
      latLngToCell: vi.fn(),
      getNeighbors: vi.fn(),
      cellToLatLng: vi.fn(),
      haversineDistance: vi.fn(),
    } as Mocked<IGeoService>;
    mockDistance = {
      getEnrichedDrivers: vi.fn(),
    } as Mocked<IDistanceService>;
    mockSimulation = {
      startSimulation: vi.fn(),
      advanceSimulation: vi.fn(),
      startSimulationForBooking: vi.fn(),
    } as Mocked<ISimulationService>;
    service = new DispatchService(
      mockCache,
      mockAmbulanceRepo,
      mockGeo,
      mockDistance,
      mockSimulation,
    );
  });

  it("should find nearby drivers from DB and call distance service for enrichment", async () => {
    mockGeo.getNeighbors.mockReturnValue(["878c84c525fff"]);
    mockAmbulanceRepo.findAvailableAmbulances.mockResolvedValue([
      { id: "driver_1", lat: -6.1, lng: 106.8 },
    ]);
    mockDistance.getEnrichedDrivers.mockResolvedValue([
      {
        id: "driver_1",
        lat: -6.1,
        lng: 106.8,
        eta: "5 mins",
        distance: "1.2 km",
      } as AmbulanceLocation & { id: string; eta: string; distance: string },
    ]);

    const results = await service.findNearbyAmbulances(
      "878c84c525fff",
      1,
      "-6.12,106.85",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "driver_1",
      eta: "5 mins",
    });

    expect(mockGeo.getNeighbors).toHaveBeenCalledWith("878c84c525fff", 1);
    expect(mockAmbulanceRepo.findAvailableAmbulances).toHaveBeenCalledWith([
      "878c84c525fff",
    ]);
    expect(mockDistance.getEnrichedDrivers).toHaveBeenCalled();
  });

  it("should return raw drivers from DB without enrichment if pickupLocation is missing", async () => {
    mockGeo.getNeighbors.mockReturnValue(["878c84c525fff"]);
    mockAmbulanceRepo.findAvailableAmbulances.mockResolvedValue([
      { id: "driver_1", lat: -6.1, lng: 106.8 },
    ]);
    mockDistance.getEnrichedDrivers.mockResolvedValue([
      { id: "driver_1", eta: "10 mins" } as DriverDetails,
    ]);

    const results = await service.findNearbyAmbulances("878c84c525fff", 1);

    expect(mockGeo.getNeighbors).toHaveBeenCalledWith("878c84c525fff", 1);
    expect(mockAmbulanceRepo.findAvailableAmbulances).toHaveBeenCalledWith([
      "878c84c525fff",
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: "driver_1", lat: -6.1, lng: 106.8 });
    expect(mockDistance.getEnrichedDrivers).not.toHaveBeenCalled();
  });

  it("should return empty array and skip distance enrichment if no drivers found in DB", async () => {
    mockGeo.getNeighbors.mockReturnValue(["878c84c525fff"]);
    mockAmbulanceRepo.findAvailableAmbulances.mockResolvedValue([]);

    const results = await service.findNearbyAmbulances(
      "878c84c525fff",
      1,
      "-6.12,106.85",
    );

    expect(results).toHaveLength(0);
    expect(mockDistance.getEnrichedDrivers).not.toHaveBeenCalled();
  });

  describe("updateDriverStatus", () => {
    it("should advance simulation when pinged", async () => {
      const mockDriverId = "driver-123";

      await service.updateDriverStatus(mockDriverId, { lat: 0, lng: 0 }, "h3");

      expect(mockCache.updateDriverLocation).toHaveBeenCalledWith(
        mockDriverId,
        { lat: 0, lng: 0 },
        "h3",
        300,
        undefined,
      );
      expect(mockSimulation.advanceSimulation).toHaveBeenCalledWith(
        mockDriverId,
      );
    });
  });
});
