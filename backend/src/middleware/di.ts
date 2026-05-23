import { MiddlewareHandler } from "hono";
import { DispatchService, IDispatchService } from "../services/dispatch";
import { SupabaseRepository } from "../infrastructure/supabase";
import { UpstashRedisRepository } from "../infrastructure/upstash";
import { GoogleMapsRepository } from "../infrastructure/google-maps";
import { Bindings } from "../schemas/env";
import { AppVariables, ILogger } from "../types";
import { GeoService } from "../services/geo";
import { DistanceService } from "../services/distance";
import { ProviderService, IProviderService } from "../services/providers";
import { HospitalService, IHospitalService } from "../services/hospitals";
import { Logger } from "../utils/logger";

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
  let geoService: GeoService | undefined;
  let logger: ILogger | undefined;

  const getLogger = () => {
    if (!logger) logger = new Logger();
    return logger;
  };

  c.set("getLogger", getLogger);

  const getGeo = () => {
    if (!geoService) geoService = new GeoService();
    return geoService;
  };

  c.set("getProviderService", () => {
    if (!providerService) {
      const dbRepo = c.get("getDb")();
      providerService = new ProviderService(dbRepo, getGeo());
    }
    return providerService;
  });

  c.set("getHospitalService", () => {
    if (!hospitalService) {
      const dbRepo = c.get("getDb")();
      hospitalService = new HospitalService(dbRepo, getGeo());
    }
    return hospitalService;
  });

  c.set("getDispatchService", () => {
    if (!dispatchService) {
      const cacheRepo = c.get("getCache")();
      const dbRepo = c.get("getDb")();
      const maps = c.get("getMaps")();
      const geo = getGeo();
      const distanceService = new DistanceService(maps, cacheRepo, geo);

      dispatchService = new DispatchService(
        cacheRepo,
        dbRepo,
        geo,
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
