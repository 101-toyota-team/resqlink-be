import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { DispatchService } from "../src/services/dispatch";
import { IAmbulanceRepository } from "../src/repositories/ambulance";
import { IGeoService } from "../src/services/geo";
import { IDistanceService } from "../src/services/distance";
import { AmbulanceLocation, AmbulanceDetails } from "../src/types";

describe("DispatchService", () => {
  let mockAmbulanceRepo: Mocked<IAmbulanceRepository>;
  let mockGeo: Mocked<IGeoService>;
  let mockDistance: Mocked<IDistanceService>;
  let service: DispatchService;

  beforeEach(() => {
    mockAmbulanceRepo = {
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
    } as Mocked<IAmbulanceRepository>;
    mockGeo = {
      parseLatLng: vi.fn(),
      latLngToCell: vi.fn(),
      getNeighbors: vi.fn(),
      getRing: vi.fn(),
      cellToLatLng: vi.fn(),
      haversineDistance: vi.fn(),
    } as Mocked<IGeoService>;
    mockDistance = {
      getEnrichedDrivers: vi.fn(),
      getRouteLeg: vi.fn(),
    } as unknown as Mocked<IDistanceService>;
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };
    service = new DispatchService(
      mockAmbulanceRepo,
      mockGeo,
      mockDistance,
      mockLogger,
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
        eta_value: 300,
        distance_value: 1200,
      } as AmbulanceLocation & {
        id: string;
        eta: string;
        distance: string;
        eta_value: number;
        distance_value: number;
      },
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
      { id: "driver_1", eta: "10 mins" } as any,
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
});
