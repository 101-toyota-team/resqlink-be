import { MiddlewareHandler } from "hono";
import { DispatchService, IDispatchService } from "../services/dispatch";
import { SupabaseRepository } from "../infrastructure/supabase";
import { UpstashRedisRepository } from "../infrastructure/upstash";
import { GoogleMapsRepository } from "../infrastructure/google-maps";
import { Bindings } from "../schemas/env";
import { AppVariables } from "../types";
import { GeoService } from "../services/geo";
import { DistanceService } from "../services/distance";
import { ProviderService, IProviderService } from "../services/providers";
import { HospitalService, IHospitalService } from "../services/hospitals";

export const diMiddleware: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: AppVariables;
}> = async (c, next) => {
  let dispatchService: IDispatchService | undefined;
  let providerService: IProviderService | undefined;
  let hospitalService: IHospitalService | undefined;
  let dbRepo: SupabaseRepository | undefined;
  let mapsRepo: GoogleMapsRepository | undefined;
  let cacheRepo: UpstashRedisRepository | undefined;

  c.set("getProviderService", () => {
    if (!providerService) {
      const dbRepo = c.get("getDb")();
      const geoService = new GeoService();
      providerService = new ProviderService(dbRepo, geoService);
    }
    return providerService;
  });

  c.set("getHospitalService", () => {
    if (!hospitalService) {
      const dbRepo = c.get("getDb")();
      const geoService = new GeoService();
      hospitalService = new HospitalService(dbRepo, geoService);
    }
    return hospitalService;
  });

  c.set("getDispatchService", () => {
    if (!dispatchService) {
      const cacheRepo = new UpstashRedisRepository(
        c.env.UPSTASH_REDIS_REST_URL,
        c.env.UPSTASH_REDIS_REST_TOKEN,
      );
      const dbRepo = c.get("getDb")();
      const maps = new GoogleMapsRepository(c.env.GOOGLE_MAPS_API_KEY);
      const geoService = new GeoService();
      const distanceService = new DistanceService(maps, cacheRepo, geoService);

      dispatchService = new DispatchService(
        cacheRepo,
        dbRepo,
        geoService,
        distanceService,
        maps,
      );
    }
    return dispatchService;
  });

  c.set("getDb", () => {
    if (!dbRepo) {
      dbRepo = new SupabaseRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
      );
    }
    return dbRepo;
  });

  c.set("getMaps", () => {
    if (!mapsRepo) {
      mapsRepo = new GoogleMapsRepository(c.env.GOOGLE_MAPS_API_KEY);
    }
    return mapsRepo;
  });

  c.set("getCache", () => {
    if (!cacheRepo) {
      cacheRepo = new UpstashRedisRepository(
        c.env.UPSTASH_REDIS_REST_URL,
        c.env.UPSTASH_REDIS_REST_TOKEN,
      );
    }
    return cacheRepo;
  });

  await next();
};
