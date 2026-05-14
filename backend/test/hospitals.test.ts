import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import hospitalsApp from "../src/routes/hospitals";
import { ERROR_MESSAGES } from "../src/utils/constants";
import { AppVariables, Hospital, HospitalDetails } from "../src/types";
import { Bindings } from "../src/schemas/env";
import { IHospitalService } from "../src/services/hospitals";

interface MockHospitalService {
  searchHospitals: ReturnType<typeof vi.fn>;
  findNearbyHospitals: ReturnType<typeof vi.fn>;
}

const createApp = (serviceMock: MockHospitalService) => {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

  app.use("*", async (c, next) => {
    c.set(
      "getHospitalService",
      () => serviceMock as unknown as IHospitalService,
    );
    await next();
  });

  app.route("/hospitals", hospitalsApp);
  return app;
};

describe("Hospitals API", () => {
  let serviceMock: MockHospitalService;

  beforeEach(() => {
    serviceMock = {
      searchHospitals: vi.fn(),
      findNearbyHospitals: vi.fn(),
    };
  });

  describe("GET /hospitals/search", () => {
    it("should return 200 and search results on success", async () => {
      const mockResults: Hospital[] = [
        {
          id: "1",
          name: "Hospital A",
          h3_index: "878c106a4ffffff",
          latitude: -6.2,
          longitude: 106.8,
          provider_type: "rumah_sakit",
          address: "Address A",
          phone: "123456",
          created_at: new Date().toISOString(),
          igd_phone: "119",
          rating: 4.5,
          rating_count: 100,
        },
        {
          id: "2",
          name: "Hospital B",
          h3_index: "878c107a4ffffff",
          latitude: -6.3,
          longitude: 106.9,
          provider_type: "rumah_sakit",
          address: "Address B",
          phone: "789012",
          created_at: new Date().toISOString(),
          igd_phone: "118",
          rating: 4.2,
          rating_count: 50,
        },
      ];
      serviceMock.searchHospitals.mockResolvedValue(mockResults);

      const app = createApp(serviceMock);
      const res = await app.request("/hospitals/search?q=Hospital");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockResults);
      expect(serviceMock.searchHospitals).toHaveBeenCalledWith("Hospital");
    });

    it("should return 400 for validation errors (e.g. query too short)", async () => {
      const app = createApp(serviceMock);
      const res = await app.request("/hospitals/search?q=H"); // 1 char, min is 2

      expect(res.status).toBe(400);
      expect(serviceMock.searchHospitals).not.toHaveBeenCalled();
    });

    it("should return 500 on service error", async () => {
      serviceMock.searchHospitals.mockRejectedValue(
        new Error("Database Error"),
      );

      const app = createApp(serviceMock);
      const res = await app.request("/hospitals/search?q=Hospital");

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.HOSPITALS_FAILED);
    });

    it("should handle non-Error objects thrown in catch block", async () => {
      serviceMock.searchHospitals.mockRejectedValue("String error");

      const app = createApp(serviceMock);
      const res = await app.request("/hospitals/search?q=Hospital");

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.HOSPITALS_FAILED);
    });
  });

  describe("GET /hospitals/nearby", () => {
    it("should return 200 and nearby hospitals", async () => {
      const h3Index = "878c106a4ffffff";
      const mockResults: HospitalDetails[] = [
        {
          id: "1",
          name: "Hospital A",
          h3_index: h3Index,
          latitude: -6.2,
          longitude: 106.8,
          provider_type: "rumah_sakit",
          address: "Address A",
          phone: "123456",
          created_at: new Date().toISOString(),
          igd_phone: "119",
          rating: 4.5,
          rating_count: 100,
          distance: "2.5 km",
        },
      ];
      serviceMock.findNearbyHospitals.mockResolvedValue(mockResults);

      const app = createApp(serviceMock);
      const res = await app.request(`/hospitals/nearby?h3_index=${h3Index}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockResults);
      expect(serviceMock.findNearbyHospitals).toHaveBeenCalledWith(h3Index);
    });

    it("should return 400 for invalid H3 index", async () => {
      const app = createApp(serviceMock);
      const res = await app.request("/hospitals/nearby?h3_index=invalid");

      expect(res.status).toBe(400);
      expect(serviceMock.findNearbyHospitals).not.toHaveBeenCalled();
    });
  });
});
