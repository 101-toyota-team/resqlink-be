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
import { AppVariables } from "../types";
import { GeoService } from "../services/geo";
import { DistanceService } from "../services/distance";
import { ProviderService, IProviderService } from "../services/providers";
import { HospitalService, IHospitalService } from "../services/hospitals";
import { DriverService, IDriverService } from "../services/driver";
import { DriverLocationRepository } from "../infrastructure/driver-location";
import { DriverRepository } from "../infrastructure/driver-repo";

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

  c.set("getDistanceService", () => {
    if (!distanceService) {
      distanceService = new DistanceService(
        c.get("getMaps")(),
        c.get("getCache")(),
        getGeo(),
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
      );
    }
    return driverLocationRepo;
  });

  c.set("getDriverRepo", () => {
    if (!driverRepo) {
      driverRepo = new DriverRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY,
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
      dispatchService = new DispatchService(
        c.get("getAmbulanceRepo")(),
        getGeo(),
        c.get("getDistanceService")(),
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
      );
    }
    return driverService;
  });

  await next();
};
