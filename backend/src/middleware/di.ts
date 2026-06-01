import { MiddlewareHandler } from "hono";
import { BookingService, IBookingService } from "../services/bookings";
import { DispatchService, IDispatchService } from "../services/dispatch";
import { SimulationService, ISimulationService } from "../services/simulation";
import {
  BookingRepository,
  AmbulanceRepository,
  ProviderRepository,
  HospitalRepository,
  RealtimeBroadcaster,
} from "../infrastructure/supabase";
import { UpstashRedisRepository } from "../infrastructure/upstash";
import { MapboxRepository } from "../infrastructure/mapbox";
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
  let bookingService: IBookingService | undefined;
  let simulationService: ISimulationService | undefined;
  let dispatchService: IDispatchService | undefined;
  let providerService: IProviderService | undefined;
  let hospitalService: IHospitalService | undefined;
  let bookingRepo: BookingRepository | undefined;
  let ambulanceRepo: AmbulanceRepository | undefined;
  let providerRepo: ProviderRepository | undefined;
  let hospitalRepo: HospitalRepository | undefined;
  let realtimeRepo: RealtimeBroadcaster | undefined;
  let mapsRepo: MapboxRepository | undefined;
  let cacheRepo: UpstashRedisRepository | undefined;
  let geoService: GeoService | undefined;

  const getGeo = () => {
    if (!geoService) geoService = new GeoService();
    return geoService;
  };

  c.set("getBookingRepo", () => {
    if (!bookingRepo) {
      bookingRepo = new BookingRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
      );
    }
    return bookingRepo;
  });

  c.set("getAmbulanceRepo", () => {
    if (!ambulanceRepo) {
      ambulanceRepo = new AmbulanceRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
      );
    }
    return ambulanceRepo;
  });

  c.set("getProviderRepo", () => {
    if (!providerRepo) {
      providerRepo = new ProviderRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
      );
    }
    return providerRepo;
  });

  c.set("getHospitalRepo", () => {
    if (!hospitalRepo) {
      hospitalRepo = new HospitalRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
      );
    }
    return hospitalRepo;
  });

  c.set("getRealtimeRepo", () => {
    if (!realtimeRepo) {
      realtimeRepo = new RealtimeBroadcaster(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
      );
    }
    return realtimeRepo;
  });

  c.set("getSimulationService", () => {
    if (!simulationService) {
      simulationService = new SimulationService(
        c.get("getCache")(),
        c.get("getBookingRepo")(),
        c.get("getAmbulanceRepo")(),
        c.get("getRealtimeRepo")(),
        c.get("getMaps")(),
      );
    }
    return simulationService;
  });

  c.set("getBookingService", () => {
    if (!bookingService) {
      bookingService = new BookingService(
        c.get("getBookingRepo")(),
        c.get("getAmbulanceRepo")(),
        c.get("getRealtimeRepo")(),
        c.get("getSimulationService")(),
      );
    }
    return bookingService;
  });

  c.set("getProviderService", () => {
    if (!providerService) {
      providerService = new ProviderService(
        c.get("getProviderRepo")(),
        getGeo(),
      );
    }
    return providerService;
  });

  c.set("getHospitalService", () => {
    if (!hospitalService) {
      hospitalService = new HospitalService(
        c.get("getHospitalRepo")(),
        getGeo(),
      );
    }
    return hospitalService;
  });

  c.set("getDispatchService", () => {
    if (!dispatchService) {
      // Cache is passed to DistanceService for distance matrix API caching,
      // not to DispatchService (which no longer uses cache directly)
      const cache = c.get("getCache")();
      const ambulanceRepo = c.get("getAmbulanceRepo")();
      const maps = c.get("getMaps")();
      const geo = getGeo();
      const distanceService = new DistanceService(maps, cache, geo);

      dispatchService = new DispatchService(
        ambulanceRepo,
        geo,
        distanceService,
        c.get("getSimulationService")(),
      );
    }
    return dispatchService;
  });

  c.set("getMaps", () => {
    if (!mapsRepo) {
      mapsRepo = new MapboxRepository(c.env.MAPBOX_ACCESS_TOKEN);
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
