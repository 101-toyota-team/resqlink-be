import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import providersApp from "../src/routes/providers";
import { ERROR_MESSAGES } from "../src/utils/constants";
import { AppVariables, Provider } from "../src/types";
import { Bindings } from "../src/schemas/env";
import { IProviderService, ProviderService } from "../src/services/providers";
import { IPersistenceRepository } from "../src/repositories/db";
import { IGeoService } from "../src/services/geo";

interface MockProviderService {
  searchProviders: ReturnType<typeof vi.fn>;
  findNearbyProviders: ReturnType<typeof vi.fn>;
}

const createApp = (serviceMock: IProviderService) => {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

  app.use("*", async (c, next) => {
    c.set("getProviderService", () => serviceMock);
    await next();
  });

  app.route("/providers", providersApp);
  return app;
};

describe("ProviderService", () => {
  let mockDb: IPersistenceRepository;
  let mockGeo: IGeoService;
  let service: ProviderService;

  beforeEach(() => {
    mockDb = {
      searchProviders: vi.fn(),
      findProvidersByH3Indexes: vi.fn(),
    } as unknown as IPersistenceRepository;
    mockGeo = {
      getNeighbors: vi.fn(),
    } as unknown as IGeoService;
    service = new ProviderService(mockDb, mockGeo);
  });

  it("should expand abbreviations like RS in search query", async () => {
    await service.searchProviders("RS Duren Sawit");
    expect(mockDb.searchProviders).toHaveBeenCalledWith(
      "Rumah Sakit Duren Sawit",
    );
  });

  it("should expand multiple abbreviations", async () => {
    await service.searchProviders("RSUD and RSIA");
    expect(mockDb.searchProviders).toHaveBeenCalledWith(
      "Rumah Sakit Umum Daerah and Rumah Sakit Ibu dan Anak",
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
    it("should return 200 and search results on success", async () => {
      const mockResults: Provider[] = [
        {
          id: "1",
          name: "Provider A",
          h3_index: "8828308281fffff",
          latitude: -6.2,
          longitude: 106.8,
          provider_type: "hospital",
          created_at: new Date().toISOString(),
        },
      ];
      serviceMock.searchProviders.mockResolvedValue(mockResults);

      const app = createApp(serviceMock as unknown as IProviderService);
      const res = await app.request("/providers/search?q=Provider");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockResults);
      expect(serviceMock.searchProviders).toHaveBeenCalledWith("Provider");
    });

    it("should return 400 for validation errors (e.g. query too short)", async () => {
      const app = createApp(serviceMock as unknown as IProviderService);
      const res = await app.request("/providers/search?q=P"); // 1 char, min is 2

      expect(res.status).toBe(400);
      expect(serviceMock.searchProviders).not.toHaveBeenCalled();
    });

    it("should return 500 on service error", async () => {
      serviceMock.searchProviders.mockRejectedValue(
        new Error("Database error"),
      );

      const app = createApp(serviceMock as unknown as IProviderService);
      const res = await app.request("/providers/search?q=Provider");

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });

  describe("GET /providers/nearby", () => {
    it("should return 200 and nearby providers", async () => {
      const h3Index = "8828308281fffff";
      const mockResults: Provider[] = [
        {
          id: "1",
          name: "Provider A",
          h3_index: h3Index,
          latitude: -6.2,
          longitude: 106.8,
          provider_type: "hospital",
          created_at: new Date().toISOString(),
        },
      ];
      serviceMock.findNearbyProviders.mockResolvedValue(mockResults);

      const app = createApp(serviceMock as unknown as IProviderService);
      const res = await app.request(`/providers/nearby?h3_index=${h3Index}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockResults);
      expect(serviceMock.findNearbyProviders).toHaveBeenCalledWith(h3Index);
    });

    it("should return 400 for invalid H3 index", async () => {
      const app = createApp(serviceMock as unknown as IProviderService);
      const res = await app.request("/providers/nearby?h3_index=invalid");

      expect(res.status).toBe(400);
      expect(serviceMock.findNearbyProviders).not.toHaveBeenCalled();
    });
  });
});
