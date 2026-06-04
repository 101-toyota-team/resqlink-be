import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { MapboxRepository } from "../src/infrastructure/mapbox";
import { ILogger } from "../src/types";

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
} as unknown as ILogger;

describe("MapboxRepository", () => {
  const accessToken = "test-token";
  let repo: MapboxRepository;
  let fetchMock: Mock;

  beforeEach(() => {
    repo = new MapboxRepository(accessToken, mockLogger);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  describe("getDirections", () => {
    it("should call Mapbox API with swapped coordinates and return mapped response", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            geometry: "encoded-polyline6",
          },
        ],
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const origin = "-6.2,106.8";
      const destination = "-6.3,106.9";
      const result = await repo.getDirections(origin, destination);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("106.8,-6.2;106.9,-6.3"),
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("geometries=polyline6"),
        expect.anything(),
      );
      expect(result.status).toBe("OK");
      expect(result.routes[0].overview_polyline.points).toBe(
        "encoded-polyline6",
      );
    });

    it("should handle Mapbox error codes", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ code: "NoRoute" }),
      });

      const result = await repo.getDirections("-6.2,106.8", "-6.3,106.9");
      expect(result.status).toBe("ZERO_RESULTS");
    });

    it("should throw error on non-ok response", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      });

      await expect(
        repo.getDirections("-6.2,106.8", "-6.3,106.9"),
      ).rejects.toThrow("Mapbox API error: 401 Unauthorized");
    });
  });

  describe("getDistanceMatrix", () => {
    it("should batch origins when they exceed Mapbox limits", async () => {
      // Max total is 25. If 1 destination, max origins per chunk is 24.
      // Let's test with 30 origins and 1 destination.
      const origins = Array.from({ length: 30 }, (_, i) => `-6.${i},106.${i}`);
      const destinations = ["-6.5,106.5"];

      const mockChunk1 = {
        code: "Ok",
        distances: Array(24).fill(Array(1).fill(1000)),
        durations: Array(24).fill(Array(1).fill(60)),
      };
      const mockChunk2 = {
        code: "Ok",
        distances: Array(6).fill(Array(1).fill(2000)),
        durations: Array(6).fill(Array(1).fill(120)),
      };

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChunk1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChunk2,
        });

      const result = await repo.getDistanceMatrix(origins, destinations);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.rows).toHaveLength(30);
      expect(result.rows[0].elements[0].distance.value).toBe(1000);
      expect(result.rows[24].elements[0].distance.value).toBe(2000);
      expect(result.status).toBe("OK");
    });

    it("should throw error if too many destinations", async () => {
      const origins = ["-6.1,106.1"];
      const destinations = Array.from(
        { length: 25 },
        (_, i) => `-6.${i},106.${i}`,
      );

      await expect(
        repo.getDistanceMatrix(origins, destinations),
      ).rejects.toThrow("Too many destinations for Mapbox Matrix API");
    });

    it("should handle null distances/durations as ZERO_RESULTS", async () => {
      const mockResponse = {
        code: "Ok",
        distances: [[null]],
        durations: [[null]],
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await repo.getDistanceMatrix(
        ["-6.1,106.1"],
        ["-6.2,106.2"],
      );
      expect(result.rows[0].elements[0].status).toBe("ZERO_RESULTS");
      expect(result.rows[0].elements[0].distance.value).toBe(0);
    });
  });
});
