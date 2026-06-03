import { IDispatchService } from "./services/dispatch";
import { IBookingService } from "./services/bookings";
import { IProviderService } from "./services/providers";
import { IHospitalService } from "./services/hospitals";
import {
  IBookingRepository,
  IAmbulanceRepository,
  IProviderRepository,
  IHospitalRepository,
  IRealtimeBroadcaster,
} from "./repositories/db";
import { IMapsRepository } from "./repositories/maps";
import { IGenericCache } from "./repositories/generic-cache";
import type { BookingStatus } from "./utils/constants";

export interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  captured_at: string;
  booking_id?: string;
}

export interface Driver {
  id: string;
  provider_id: string;
  name: string;
  phone: string;
  license_number: string;
  is_available: boolean;
  current_ambulance_id?: string;
  rating: number;
  is_active: boolean;
}

export const PROVIDER_TYPES = [
  "rumah_sakit",
  "klinik",
  "komunitas",
  "rt_rw",
  "yayasan",
  "masjid",
  "lainnya",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export interface Viewport {
  low: { lat: number; lng: number };
  high: { lat: number; lng: number };
}

export interface RouteLeg {
  sequence: number;
  encoded_polyline: string;
}

export interface RouteGeometry {
  total_distance_meters: number;
  total_duration_seconds: number;
  combined_viewport: Viewport;
  legs: RouteLeg[];
}

export interface Provider {
  id: string;
  name: string;
  h3_index: string;
  latitude: number;
  longitude: number;
  provider_type: ProviderType;
  address?: string;
  phone?: string;
  created_at: string;
}

export interface ProviderDetails extends Provider {
  distance?: string;
  distance_value?: number;
}

export interface Hospital extends Provider {
  igd_phone: string;
  igd_email?: string;
  bed_capacity?: number;
  specializations?: string[];
  accreditation?: string;
  rating: number;
  rating_count: number;
  website_url?: string;
}

export interface HospitalDetails extends Hospital {
  distance?: string;
  distance_value?: number;
}

export interface AmbulanceInfo {
  id: string;
  provider_id: string;
}

export interface AmbulanceLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}

export interface AmbulanceDetails extends AmbulanceLocation {
  id: string;
  eta?: string;
  distance?: string;
  eta_value?: number;
  distance_value?: number;
}

export interface BookingData {
  ambulance_id?: string | null;
  provider_id?: string | null;
  driver_id?: string | null;
  booking_type: "medis" | "sosial" | "jenazah" | "darurat";
  patient_condition: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_h3: string;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  user_id?: string;
  estimated_price?: number;
  route_geometry?: RouteGeometry | null;
}

export interface Booking extends BookingData {
  id: string;
  status: BookingStatus;
  created_at: string;
}

export interface JwtPayload {
  sub: string;
  role?: string;
  app_metadata?: {
    role?: string;
    provider_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DistanceMatrixElement {
  status: string;
  duration: { text: string; value: number };
  distance: { text: string; value: number };
}

export interface DistanceMatrixResponse {
  rows: {
    elements: DistanceMatrixElement[];
  }[];
  status: string;
}

export interface DirectionsRoute {
  overview_polyline: { points: string };
  distance?: number;
  duration?: number;
}

export interface DirectionsResponse {
  routes: DirectionsRoute[];
  status: string;
}

export interface ILogger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

import type { IDriverService } from "./services/driver";
import type { IDriverLocationRepository } from "./repositories/driver-location";

export interface AppVariables {
  getBookingService: () => IBookingService;
  getDispatchService: () => IDispatchService;
  getProviderService: () => IProviderService;
  getHospitalService: () => IHospitalService;
  getBookingRepo: () => IBookingRepository;
  getAmbulanceRepo: () => IAmbulanceRepository;
  getProviderRepo: () => IProviderRepository;
  getHospitalRepo: () => IHospitalRepository;
  getRealtimeRepo: () => IRealtimeBroadcaster;
  getMaps: () => IMapsRepository;
  getCache: () => IGenericCache;
  getDistanceService: () => import("./services/distance").IDistanceService;
  getDriverService: () => IDriverService;
  getDriverLocationRepo: () => IDriverLocationRepository;
  getDriverRepo: () => import("./repositories/driver").IDriverRepository;
  jwtPayload: JwtPayload;
}
