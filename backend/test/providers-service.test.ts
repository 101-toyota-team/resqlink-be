import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { ProviderService } from "../src/services/providers";
import { IProviderRepository } from "../src/repositories/provider";
import { IGeoService } from "../src/services/geo";
import { Provider, ProviderType } from "../src/types";
import { PROVIDER_SEARCH } from "../src/utils/constants";

describe("ProviderService", () => {
  let mockRepo: Mocked<IProviderRepository>;
  let mockGeo: Mocked<IGeoService>;
  let service: ProviderService;

  const makeProvider = (overrides?: Partial<Provider>): Provider => ({
    id: "p1",
    name: "Test Provider",
    h3_index: "878c84c525fff",
    latitude: -6.2,
    longitude: 106.8,
    provider_type: "rumah_sakit" as ProviderType,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    mockRepo = {
      searchProviders: vi.fn(),
      findProvidersByH3Indexes: vi.fn().mockResolvedValue([]),
    } as Mocked<IProviderRepository>;

    mockGeo = {
      getNeighbors: vi.fn(),
      getRing: vi.fn().mockReturnValue([]),
      latLngToCell: vi.fn(),
      parseLatLng: vi.fn(),
      cellToLatLng: vi.fn(),
      haversineDistance: vi.fn(),
    } as Mocked<IGeoService>;

    service = new ProviderService(mockRepo, mockGeo);
  });

  describe("searchProviders", () => {
    it("returns empty array when repo returns empty", async () => {
      mockRepo.searchProviders.mockResolvedValue([]);
      const result = await service.searchProviders("test");
      expect(result).toEqual([]);
    });

    it("propagates abbreviation expansion correctly", async () => {
      mockRepo.searchProviders.mockResolvedValue([]);
      await service.searchProviders("RS jakarta");
      expect(mockRepo.searchProviders).toHaveBeenCalledWith(
        "RS jakarta",
        "Rumah Sakit jakarta",
        undefined,
      );
    });

    it("preserves non-abbreviated queries", async () => {
      mockRepo.searchProviders.mockResolvedValue([]);
      await service.searchProviders("klinik");
      expect(mockRepo.searchProviders).toHaveBeenCalledWith(
        "klinik",
        "klinik",
        undefined,
      );
    });

    it("passes limit to repository when provided", async () => {
      mockRepo.searchProviders.mockResolvedValue([]);
      await service.searchProviders("RS jakarta", 5);
      expect(mockRepo.searchProviders).toHaveBeenCalledWith(
        "RS jakarta",
        "Rumah Sakit jakarta",
        5,
      );
    });

    it("propagates repo errors", async () => {
      mockRepo.searchProviders.mockRejectedValue(new Error("DB error"));
      await expect(service.searchProviders("test")).rejects.toThrow("DB error");
    });
  });

  describe("findNearbyProviders", () => {
    it("uses cellToLatLng when lat/lng not provided", async () => {
      const h3Index = "878c84c525fff";
      mockGeo.cellToLatLng.mockReturnValue({ lat: -6.2, lng: 106.8 });
      mockRepo.findProvidersByH3Indexes.mockResolvedValue([]);

      await service.findNearbyProviders(h3Index);

      expect(mockGeo.cellToLatLng).toHaveBeenCalledWith(h3Index);
    });

    it("uses provided lat/lng when supplied", async () => {
      const h3Index = "878c84c525fff";
      mockRepo.findProvidersByH3Indexes.mockResolvedValue([]);

      await service.findNearbyProviders(h3Index, -6.2, 106.8);

      expect(mockGeo.cellToLatLng).not.toHaveBeenCalled();
    });

    it("returns empty array when no providers found", async () => {
      mockGeo.cellToLatLng.mockReturnValue({ lat: -6.2, lng: 106.8 });
      mockGeo.getRing.mockReturnValue([]);
      mockRepo.findProvidersByH3Indexes.mockResolvedValue([]);

      const result = await service.findNearbyProviders("878c84c525fff");

      expect(result).toEqual([]);
    });

    it("queries providers on ring 0 only", async () => {
      const h3Index = "878c84c525fff";
      mockGeo.cellToLatLng.mockReturnValue({ lat: -6.2, lng: 106.8 });
      mockGeo.haversineDistance.mockReturnValue(0);
      mockRepo.findProvidersByH3Indexes.mockImplementation(
        async (cells: string[]) => {
          if (cells.includes(h3Index)) {
            return [makeProvider({ h3_index: h3Index })];
          }
          return [];
        },
      );

      const result = await service.findNearbyProviders(h3Index);

      expect(result).toHaveLength(1);
      expect(result[0].h3_index).toBe(h3Index);
    });

    it("queries across progressive rings", async () => {
      const h3Index = "center";
      mockGeo.cellToLatLng.mockReturnValue({ lat: 0, lng: 0 });
      mockGeo.getRing.mockImplementation((_, r) => [`ring-${r}`]);
      mockGeo.haversineDistance.mockReturnValue(1);

      mockRepo.findProvidersByH3Indexes.mockImplementation(
        async (cells: string[]) => {
          if (cells.includes("ring-5")) {
            return [makeProvider({ id: "p5", h3_index: "ring-5" })];
          }
          return [];
        },
      );

      const result = await service.findNearbyProviders(h3Index);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p5");
    });

    it("batches H3 cells when ring has >100 cells", async () => {
      const h3Index = "center";
      mockGeo.cellToLatLng.mockReturnValue({ lat: 0, lng: 0 });
      const manyCells = Array.from({ length: 150 }, (_, i) => `cell-${i}`);
      mockGeo.getRing.mockImplementation((_, r) => (r === 1 ? manyCells : []));
      mockRepo.findProvidersByH3Indexes.mockResolvedValue([]);

      await service.findNearbyProviders(h3Index);

      expect(mockRepo.findProvidersByH3Indexes).toHaveBeenCalledTimes(2);
      expect(mockRepo.findProvidersByH3Indexes).toHaveBeenCalledWith([
        "center",
        ...manyCells.slice(0, 99),
      ]);
      expect(mockRepo.findProvidersByH3Indexes).toHaveBeenCalledWith(
        manyCells.slice(99, 150),
      );
    });

    it("lookahead stops early when MAX_RESULTS reached", async () => {
      const h3Index = "center";
      mockGeo.cellToLatLng.mockReturnValue({ lat: 0, lng: 0 });
      mockGeo.getRing.mockReturnValue(["some-cell"]);
      mockGeo.haversineDistance.mockReturnValue(1);

      // Return 50 providers in the first ringStart iteration (rings 0, 1, 2)
      const fiftyProviders = Array.from({ length: 50 }, (_, i) =>
        makeProvider({ id: `p-${i}` }),
      );
      mockRepo.findProvidersByH3Indexes.mockResolvedValueOnce(fiftyProviders);

      await service.findNearbyProviders(h3Index);

      expect(mockRepo.findProvidersByH3Indexes).toHaveBeenCalledTimes(2);
    });

    it("limits results to MAX_RESULTS", async () => {
      const h3Index = "center";
      mockGeo.cellToLatLng.mockReturnValue({ lat: 0, lng: 0 });
      mockGeo.getRing.mockReturnValue(["cell"]);
      mockGeo.haversineDistance.mockReturnValue(1);

      const hundredProviders = Array.from({ length: 100 }, (_, i) =>
        makeProvider({ id: `p-${i}` }),
      );
      mockRepo.findProvidersByH3Indexes.mockResolvedValue(hundredProviders);

      const result = await service.findNearbyProviders(h3Index);

      expect(result).toHaveLength(PROVIDER_SEARCH.MAX_RESULTS);
    });

    it("calculates and formats distance correctly", async () => {
      const h3Index = "center";
      mockGeo.cellToLatLng.mockReturnValue({ lat: 0, lng: 0 });
      mockGeo.haversineDistance.mockReturnValue(3.456);
      mockRepo.findProvidersByH3Indexes.mockResolvedValue([makeProvider()]);

      const result = await service.findNearbyProviders(h3Index);

      expect(result[0].distance).toBe("3.46 km");
      expect(result[0].distance_value).toBe(3456);
    });

    it("sorts by distance_value ascending", async () => {
      const h3Index = "center";
      mockGeo.cellToLatLng.mockReturnValue({ lat: 0, lng: 0 });
      mockGeo.haversineDistance
        .mockReturnValueOnce(5)
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(3);

      mockRepo.findProvidersByH3Indexes.mockResolvedValue([
        makeProvider({ id: "p5" }),
        makeProvider({ id: "p1" }),
        makeProvider({ id: "p3" }),
      ]);

      const result = await service.findNearbyProviders(h3Index);

      expect(result[0].id).toBe("p1");
      expect(result[1].id).toBe("p3");
      expect(result[2].id).toBe("p5");
    });

    it("handles zero distance", async () => {
      const h3Index = "center";
      mockGeo.cellToLatLng.mockReturnValue({ lat: 0, lng: 0 });
      mockGeo.haversineDistance.mockReturnValue(0);
      mockRepo.findProvidersByH3Indexes.mockResolvedValue([makeProvider()]);

      const result = await service.findNearbyProviders(h3Index);

      expect(result[0].distance).toBe("0.00 km");
      expect(result[0].distance_value).toBe(0);
    });

    it("handles empty results from some H3 batches", async () => {
      const h3Index = "center";
      mockGeo.cellToLatLng.mockReturnValue({ lat: 0, lng: 0 });
      mockGeo.getRing.mockImplementation((_, r) => [`ring-${r}`]);
      mockGeo.haversineDistance.mockReturnValue(1);

      mockRepo.findProvidersByH3Indexes
        .mockResolvedValueOnce([]) // ring 0
        .mockResolvedValueOnce([makeProvider({ id: "p1" })]); // ring 1 & 2

      const result = await service.findNearbyProviders(h3Index);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p1");
    });

    it("propagates cellToLatLng error", async () => {
      mockGeo.cellToLatLng.mockImplementation(() => {
        throw new Error("Invalid H3");
      });
      await expect(service.findNearbyProviders("invalid")).rejects.toThrow(
        "Invalid H3",
      );
    });
  });
});
