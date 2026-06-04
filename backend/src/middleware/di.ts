import { MiddlewareHandler } from "hono";
import { BookingService, IBookingService } from "../services/bookings";
import { DispatchService, IDispatchService } from "../services/dispatch";
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
import { AppVariables, ILogger } from "../types";
import { GeoService } from "../services/geo";
import { DistanceService } from "../services/distance";
import { ProviderService, IProviderService } from "../services/providers";
import { HospitalService, IHospitalService } from "../services/hospitals";
import { DriverService, IDriverService } from "../services/driver";
import { DriverLocationRepository } from "../infrastructure/driver-location";
import { DriverRepository } from "../infrastructure/driver-repo";
import { Logger } from "../utils/logger";

export const diMiddleware: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: AppVariables;
}> = async (c, next) => {
  let bookingService: IBookingService | undefined;
  let dispatchService: IDispatchService | undefined;
  let distanceService: DistanceService | undefined;
  let providerService: IProviderService | undefined;
  let hospitalService: IHospitalService | undefined;
  let driverService: IDriverService | undefined;
  let bookingRepo: BookingRepository | undefined;
  let ambulanceRepo: AmbulanceRepository | undefined;
  let providerRepo: ProviderRepository | undefined;
  let hospitalRepo: HospitalRepository | undefined;
  let realtimeRepo: RealtimeBroadcaster | undefined;
  let mapsRepo: MapboxRepository | undefined;
  let cacheRepo: UpstashRedisRepository | undefined;
  let geoService: GeoService | undefined;
  let driverLocationRepo: DriverLocationRepository | undefined;
  let driverRepo: DriverRepository | undefined;
  let loggerInstance: ILogger | undefined;

  c.set("getLogger", () => {
    if (!loggerInstance) {
      const baseLogger = new Logger(c.env.LOG_LEVEL);
      loggerInstance = baseLogger.child({
        requestId: c.get("requestId"),
        method: c.req.method,
        path: c.req.path,
      });
    }
    return loggerInstance;
  });

  const getGeo = () => {
    if (!geoService) geoService = new GeoService(c.get("getLogger")());
    return geoService;
  };

  c.set("getBookingRepo", () => {
    if (!bookingRepo) {
      bookingRepo = new BookingRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
        c.get("getLogger")(),
      );
    }
    return bookingRepo;
  });

  c.set("getAmbulanceRepo", () => {
    if (!ambulanceRepo) {
      ambulanceRepo = new AmbulanceRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
        c.get("getLogger")(),
      );
    }
    return ambulanceRepo;
  });

  c.set("getProviderRepo", () => {
    if (!providerRepo) {
      providerRepo = new ProviderRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
        c.get("getLogger")(),
      );
    }
    return providerRepo;
  });

  c.set("getHospitalRepo", () => {
    if (!hospitalRepo) {
      hospitalRepo = new HospitalRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
        c.get("getLogger")(),
      );
    }
    return hospitalRepo;
  });

  c.set("getRealtimeRepo", () => {
    if (!realtimeRepo) {
      realtimeRepo = new RealtimeBroadcaster(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
        c.get("getLogger")(),
      );
    }
    return realtimeRepo;
  });

  c.set("getMaps", () => {
    if (!mapsRepo) {
      mapsRepo = new MapboxRepository(
        c.env.MAPBOX_ACCESS_TOKEN,
        c.get("getLogger")(),
      );
    }
    return mapsRepo;
  });

  c.set("getCache", () => {
    if (!cacheRepo) {
      cacheRepo = new UpstashRedisRepository(
        c.env.UPSTASH_REDIS_REST_URL,
        c.env.UPSTASH_REDIS_REST_TOKEN,
        c.get("getLogger")(),
      );
    }
    return cacheRepo;
  });

  c.set("getDistanceService", () => {
    if (!distanceService) {
      distanceService = new DistanceService(
        c.get("getMaps")(),
        c.get("getCache")(),
        getGeo(),
        c.get("getLogger")(),
      );
    }
    return distanceService;
  });

  c.set("getDriverLocationRepo", () => {
    if (!driverLocationRepo) {
      driverLocationRepo = new DriverLocationRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
        c.get("getCache")(),
        c.get("getLogger")(),
      );
    }
    return driverLocationRepo;
  });

  c.set("getDriverRepo", () => {
    if (!driverRepo) {
      driverRepo = new DriverRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
        c.get("getLogger")(),
      );
    }
    return driverRepo;
  });

  c.set("getBookingService", () => {
    if (!bookingService) {
      bookingService = new BookingService(
        c.get("getBookingRepo")(),
        c.get("getAmbulanceRepo")(),
        c.get("getRealtimeRepo")(),
        c.get("getDistanceService")(),
        c.get("getLogger")(),
      );
    }
    return bookingService;
  });

  c.set("getProviderService", () => {
    if (!providerService) {
      providerService = new ProviderService(
        c.get("getProviderRepo")(),
        getGeo(),
        c.get("getLogger")(),
      );
    }
    return providerService;
  });

  c.set("getHospitalService", () => {
    if (!hospitalService) {
      hospitalService = new HospitalService(
        c.get("getHospitalRepo")(),
        getGeo(),
        c.get("getLogger")(),
      );
    }
    return hospitalService;
  });

  c.set("getDispatchService", () => {
    if (!dispatchService) {
      dispatchService = new DispatchService(
        c.get("getAmbulanceRepo")(),
        getGeo(),
        c.get("getDistanceService")(),
        c.get("getLogger")(),
      );
    }
    return dispatchService;
  });

  c.set("getDriverService", () => {
    if (!driverService) {
      driverService = new DriverService(
        c.get("getDriverRepo")(),
        c.get("getDriverLocationRepo")(),
        c.get("getBookingRepo")(),
        c.get("getRealtimeRepo")(),
        c.get("getLogger")(),
      );
    }
    return driverService;
  });

  await next();
};
