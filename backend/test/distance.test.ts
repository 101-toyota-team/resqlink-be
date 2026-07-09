import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { DistanceService } from "../src/services/distance";
import { IMapsRepository } from "../src/repositories/maps";
import { IGenericCache } from "../src/repositories/generic-cache";
import { IGeoService } from "../src/services/geo";
import { DistanceMatrixResponse } from "../src/types";

describe("DistanceService", () => {
  let mockMaps: Mocked<IMapsRepository>;
  let mockCache: Mocked<IGenericCache>;
  let mockGeo: Mocked<IGeoService>;
  let service: DistanceService;

  const pickupLocation = "-6.2,106.8";
  const drivers = [
    { id: "d1", lat: -6.1, lng: 106.9 },
    { id: "d2", lat: -6.3, lng: 106.7 },
  ];

  const mockMatrixResponse: DistanceMatrixResponse = {
    rows: [
      {
        elements: [
          {
            status: "OK",
            duration: { text: "5 mins", value: 300 },
            distance: { text: "2.0 km", value: 2000 },
          },
        ],
      },
      {
        elements: [
          {
            status: "OK",
            duration: { text: "8 mins", value: 480 },
            distance: { text: "3.5 km", value: 3500 },
          },
        ],
      },
    ],
    status: "OK",
  };

  beforeEach(() => {
    mockMaps = {
      getDistanceMatrix: vi.fn(),
      getDirections: vi.fn(),
    } as Mocked<IMapsRepository>;

    mockCache = {
      mget: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
      incr: vi.fn(),
      del: vi.fn(),
      rpush: vi.fn(),
      lpop: vi.fn(),
      llen: vi.fn(),
    } as unknown as Mocked<IGenericCache>;

    mockGeo = {
      parseLatLng: vi.fn().mockReturnValue({ lat: -6.2, lng: 106.8 }),
      latLngToCell: vi.fn().mockReturnValue("878c10702ffffff"),
      getNeighbors: vi.fn(),
      getRing: vi.fn(),
      cellToLatLng: vi.fn(),
      haversineDistance: vi.fn(),
    } as Mocked<IGeoService>;

    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };
    service = new DistanceService(mockMaps, mockCache, mockGeo, mockLogger);
  });

  it("returns empty array for no drivers", async () => {
    const result = await service.getEnrichedDrivers([], pickupLocation);
    expect(result).toEqual([]);
  });

  it("returns cached results without API call", async () => {
    mockCache.mget.mockResolvedValue([
      { eta: "5 mins", distance: "2000 m" },
      { eta: "8 mins", distance: "3500 m" },
    ]);

    const result = await service.getEnrichedDrivers(drivers, pickupLocation);

    expect(mockMaps.getDistanceMatrix).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].eta).toBe("5 mins");
    expect(result[0].distance).toBe("2000 m");
    expect(result[1].eta).toBe("8 mins");
  });

  it("calls API for uncached drivers and caches results", async () => {
    mockCache.mget.mockResolvedValue([null, null]);
    mockMaps.getDistanceMatrix.mockResolvedValue(mockMatrixResponse);

    const result = await service.getEnrichedDrivers(drivers, pickupLocation);

    expect(mockMaps.getDistanceMatrix).toHaveBeenCalledOnce();
    expect(mockCache.set).toHaveBeenCalledTimes(2);
    expect(result[0].eta).toBe("5 mins");
    expect(result[1].eta).toBe("8 mins");
  });

  it("handles partial cache hit", async () => {
    mockCache.mget.mockResolvedValue([
      { eta: "5 mins", distance: "2000 m" },
      null,
    ]);
    mockMaps.getDistanceMatrix.mockResolvedValue({
      rows: [
        {
          elements: [
            {
              status: "OK",
              duration: { text: "8 mins", value: 480 },
              distance: { text: "3.5 km", value: 3500 },
            },
          ],
        },
      ],
      status: "OK",
    });

    const result = await service.getEnrichedDrivers(drivers, pickupLocation);

    expect(mockCache.set).toHaveBeenCalledTimes(1);
    expect(result[0].eta).toBe("5 mins");
    expect(result[1].eta).toBe("8 mins");
  });

  it("returns Unknown when API returns non-OK status", async () => {
    mockCache.mget.mockResolvedValue([null, null]);
    mockMaps.getDistanceMatrix.mockResolvedValue({
      rows: [],
      status: "REQUEST_DENIED",
    });

    const result = await service.getEnrichedDrivers(drivers, pickupLocation);

    expect(result[0].eta).toBe("Unknown");
    expect(result[1].eta).toBe("Unknown");
  });

  it("handles element-level API failure gracefully", async () => {
    mockCache.mget.mockResolvedValue([null, null]);
    mockMaps.getDistanceMatrix.mockResolvedValue({
      rows: [
        {
          elements: [
            {
              status: "OK",
              duration: { text: "5 mins", value: 300 },
              distance: { text: "2.0 km", value: 2000 },
            },
          ],
        },
        {
          elements: [
            {
              status: "NOT_FOUND",
              duration: { text: "", value: 0 },
              distance: { text: "", value: 0 },
            },
          ],
        },
      ],
      status: "OK",
    });

    const result = await service.getEnrichedDrivers(drivers, pickupLocation);

    expect(result[0].eta).toBe("5 mins");
    expect(result[1].eta).toBe("Unknown");
    expect(mockCache.set).toHaveBeenCalledTimes(1);
  });
});
