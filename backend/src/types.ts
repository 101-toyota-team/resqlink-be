import { IDispatchService } from "./services/dispatch";
import { IPersistenceRepository } from "./repositories/db";
import { IMapsRepository } from "./repositories/maps";

export interface DriverLocation {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
}

export interface DriverDetails extends DriverLocation {
  id: string;
  eta: string;
  distance: string;
}

export interface BookingData {
  ambulance_id: string;
  booking_type: "medis" | "sosial" | "jenazah" | "darurat";
  patient_condition: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_h3: string;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  user_id: string;
}

export interface Booking extends BookingData {
  id: string;
  status: string;
  created_at: string;
}

export interface JwtPayload {
  sub: string;
  role: string;
  [key: string]: string | number | boolean | undefined;
}

export interface GoogleDistanceMatrixResponse {
  rows: {
    elements: {
      status: string;
      duration: { text: string; value: number };
      distance: { text: string; value: number };
    }[];
  }[];
  status: string;
}

export interface GoogleDirectionsResponse {
  routes: Array<{
    bounds: any;
    copyrights: string;
    legs: any[];
    overview_polyline: any;
    summary: string;
    warnings: any[];
    waypoint_order: any[];
  }>;
  status: string;
}

export interface GooglePlacesResponse {
  results: Array<{
    formatted_address: string;
    geometry: any;
    name: string;
    place_id: string;
    types: string[];
  }>;
  status: string;
}

export interface AppVariables {
  getDispatchService: () => IDispatchService;
  getDb: () => IPersistenceRepository;
  getMaps: () => IMapsRepository;
  jwtPayload: JwtPayload;
}
