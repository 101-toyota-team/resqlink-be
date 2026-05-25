import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import providersApp from "../src/routes/providers";
import { errorHandler } from "../src/middleware/error-handler";
import { ERROR_MESSAGES } from "../src/utils/constants";
import { AppVariables, Provider } from "../src/types";
import { Bindings } from "../src/schemas/env";
import { IProviderService, ProviderService } from "../src/services/providers";
import { IProviderRepository } from "../src/repositories/provider";
import { IGeoService } from "../src/services/geo";

interface MockProviderService {
  searchProviders: ReturnType<typeof vi.fn>;
  findNearbyProviders: ReturnType<typeof vi.fn>;
}

const createApp = (serviceMock: MockProviderService) => {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use("*", async (c, next) => {
    c.set("getProviderService", () => serviceMock as IProviderService);
    await next();
  });
  app.route("/providers", providersApp);
  app.onError(errorHandler);
  return app;
};

describe("ProviderService", () => {
  let mockProviderRepo: IProviderRepository;
  let mockGeo: IGeoService;
  let service: ProviderService;

  beforeEach(() => {
    mockProviderRepo = {
      searchProviders: vi.fn(),
      findProvidersByH3Indexes: vi.fn(),
    } as IProviderRepository;
    mockGeo = {
      getNeighbors: vi.fn(),
      getRing: vi.fn(),
      latLngToCell: vi.fn(),
      parseLatLng: vi.fn(),
      cellToLatLng: vi.fn(),
      haversineDistance: vi.fn(),
    } as IGeoService;
    service = new ProviderService(mockProviderRepo, mockGeo);
  });

  it("should expand abbreviations like RS in search query", async () => {
    await service.searchProviders("RS Duren Sawit");
    expect(mockProviderRepo.searchProviders).toHaveBeenCalledWith(
      "RS Duren Sawit",
      "Rumah Sakit Duren Sawit",
      undefined,
    );
  });

  it("should expand multiple abbreviations", async () => {
    await service.searchProviders("RSUD and RSIA");
    expect(mockProviderRepo.searchProviders).toHaveBeenCalledWith(
      "RSUD and RSIA",
      "Rumah Sakit Umum Daerah and Rumah Sakit Ibu dan Anak",
      undefined,
    );
  });
});

describe("Providers API", () => {
  let serviceMock: MockProviderService;

  beforeEach(() => {
    serviceMock = {
      searchProviders: vi.fn(),
      findNearbyProviders: vi.fn(),
    };
  });

  describe("GET /providers/search", () => {
    it("returns 200 and search results on success", async () => {
      const mockResults: Provider[] = [
        {
          id: "1",
          name: "Provider A",
          h3_index: "878c106a4ffffff",
          latitude: -6.2,
          longitude: 106.8,
          provider_type: "rumah_sakit",
          created_at: new Date().toISOString(),
        },
      ];
      serviceMock.searchProviders.mockResolvedValue(mockResults);

      const app = createApp(serviceMock);
      const res = await app.request("/providers/search?q=Provider");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockResults);
      expect(serviceMock.searchProviders).toHaveBeenCalledWith(
        "Provider",
        undefined,
      );
    });

    it("passes limit param to service when provided", async () => {
      serviceMock.searchProviders.mockResolvedValue([]);

      const app = createApp(serviceMock);
      const res = await app.request("/providers/search?q=test&limit=5");

      expect(res.status).toBe(200);
      expect(serviceMock.searchProviders).toHaveBeenCalledWith("test", 5);
    });

    it("rejects limit exceeding max", async () => {
      const app = createApp(serviceMock);
      const res = await app.request("/providers/search?q=test&limit=200");

      expect(res.status).toBe(400);
      expect(serviceMock.searchProviders).not.toHaveBeenCalled();
    });

    it("returns 400 for query too short", async () => {
      const app = createApp(serviceMock);
      const res = await app.request("/providers/search?q=P");

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.VALIDATION_FAILED);
      expect(serviceMock.searchProviders).not.toHaveBeenCalled();
    });

    it("returns 400 for empty query", async () => {
      const app = createApp(serviceMock);
      const res = await app.request("/providers/search?q=");

      expect(res.status).toBe(400);
      expect(serviceMock.searchProviders).not.toHaveBeenCalled();
    });

    it("returns 400 when q param missing", async () => {
      const app = createApp(serviceMock);
      const res = await app.request("/providers/search");

      expect(res.status).toBe(400);
      expect(serviceMock.searchProviders).not.toHaveBeenCalled();
    });

    it("returns 500 on service error", async () => {
      serviceMock.searchProviders.mockRejectedValue(new Error("Service Error"));

      const app = createApp(serviceMock);
      const res = await app.request("/providers/search?q=Provider");

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });

    it("handles non-Error thrown in catch", async () => {
      serviceMock.searchProviders.mockRejectedValue(new Error("string error"));

      const app = createApp(serviceMock);
      const res = await app.request("/providers/search?q=Provider");

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });

  describe("GET /providers/nearby", () => {
    it("returns 200 and nearby providers", async () => {
      const h3Index = "878c106a4ffffff";
      const mockResults: Provider[] = [
        {
          id: "1",
          name: "Provider A",
          h3_index: h3Index,
          latitude: -6.2,
          longitude: 106.8,
          provider_type: "rumah_sakit",
          created_at: new Date().toISOString(),
        },
      ];
      serviceMock.findNearbyProviders.mockResolvedValue(mockResults);

      const app = createApp(serviceMock);
      const res = await app.request(`/providers/nearby?h3_index=${h3Index}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockResults);
      expect(serviceMock.findNearbyProviders).toHaveBeenCalledWith(
        h3Index,
        undefined,
        undefined,
      );
    });

    it("passes optional lat/lng to service", async () => {
      const h3Index = "878c10702ffffff";
      serviceMock.findNearbyProviders.mockResolvedValue([]);

      const app = createApp(serviceMock);
      const res = await app.request(
        `/providers/nearby?h3_index=${h3Index}&lat=-6.2&lng=106.8`,
      );

      expect(res.status).toBe(200);
      expect(serviceMock.findNearbyProviders).toHaveBeenCalledWith(
        h3Index,
        -6.2,
        106.8,
      );
    });

    it("returns 400 for invalid H3 index", async () => {
      const app = createApp(serviceMock);
      const res = await app.request("/providers/nearby?h3_index=invalid");

      expect(res.status).toBe(400);
      expect(serviceMock.findNearbyProviders).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid lat", async () => {
      const app = createApp(serviceMock);
      const res = await app.request(
        "/providers/nearby?h3_index=878c10702ffffff&lat=999",
      );

      expect(res.status).toBe(400);
      expect(serviceMock.findNearbyProviders).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid lng", async () => {
      const app = createApp(serviceMock);
      const res = await app.request(
        "/providers/nearby?h3_index=878c10702ffffff&lng=999",
      );

      expect(res.status).toBe(400);
      expect(serviceMock.findNearbyProviders).not.toHaveBeenCalled();
    });

    it("returns 400 when h3_index missing", async () => {
      const app = createApp(serviceMock);
      const res = await app.request("/providers/nearby");

      expect(res.status).toBe(400);
      expect(serviceMock.findNearbyProviders).not.toHaveBeenCalled();
    });

    it("returns 500 on service error", async () => {
      serviceMock.findNearbyProviders.mockRejectedValue(
        new Error("Service Error"),
      );

      const app = createApp(serviceMock);
      const res = await app.request(
        "/providers/nearby?h3_index=878c106a4ffffff",
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });

    it("handles non-Error thrown in catch", async () => {
      serviceMock.findNearbyProviders.mockRejectedValue(
        new Error("string error"),
      );

      const app = createApp(serviceMock);
      const res = await app.request(
        "/providers/nearby?h3_index=878c106a4ffffff",
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });
});
