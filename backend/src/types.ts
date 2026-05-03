import { IDispatchService } from "./services/dispatch";
import { IPersistenceRepository } from "./repositories/db";

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
  booking_type: "medical" | "social";
  pickup_lat: number;
  pickup_lng: number;
  pickup_h3: string;
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
  [key: string]: any;
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
  routes: any[];
  status: string;
}

export interface GooglePlacesResponse {
  results: any[];
  status: string;
}

export interface AppVariables {
  getDispatchService: () => IDispatchService;
  getDb: () => IPersistenceRepository;
  jwtPayload: JwtPayload;
}
