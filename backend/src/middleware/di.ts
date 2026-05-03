import { MiddlewareHandler } from "hono";
import {
  DispatchService,
  IDispatchService,
} from "../services/dispatch";
import { SupabaseRepository } from "../infrastructure/supabase";
import { UpstashRedisRepository } from "../infrastructure/upstash";
import { GoogleMapsRepository } from "../infrastructure/google-maps";
import { Bindings } from "../schemas/env";
import { AppVariables } from "../types";
import { GeoService } from "../services/geo";
import { DistanceService } from "../services/distance";

export const diMiddleware: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: AppVariables;
}> = async (c, next) => {
  let dispatchService: IDispatchService | undefined;
  let dbRepo: SupabaseRepository | undefined;

  c.set("getDispatchService", () => {
    if (!dispatchService) {
      const cacheRepo = new UpstashRedisRepository(
        c.env.UPSTASH_REDIS_REST_URL,
        c.env.UPSTASH_REDIS_REST_TOKEN
      );
      const mapsRepo = new GoogleMapsRepository(c.env.GOOGLE_MAPS_API_KEY);
      const geoService = new GeoService();
      const distanceService = new DistanceService(mapsRepo, cacheRepo, geoService);
      
      dispatchService = new DispatchService(cacheRepo, geoService, distanceService);
    }
    return dispatchService;
  });

  c.set("getDb", () => {
    if (!dbRepo) {
      dbRepo = new SupabaseRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY
      );
    }
    return dbRepo;
  });

  await next();
};
