/**
 * @deprecated Import focused interfaces from domain-specific modules:
 *   - IBookingRepository  from "./booking"
 *   - IAmbulanceRepository from "./ambulance"
 *   - IProviderRepository  from "./provider"
 *   - IHospitalRepository  from "./hospital"
 *   - IRealtimeBroadcaster from "./realtime"
 *
 * IPersistenceRepository is kept for backward compatibility but new code
 * should depend on the narrower interfaces.
 */
export { IBookingRepository } from "./booking";
export { IAmbulanceRepository } from "./ambulance";
export { IProviderRepository } from "./provider";
export { IHospitalRepository } from "./hospital";
export { IRealtimeBroadcaster } from "./realtime";

import {
  Booking,
  BookingData,
  AmbulanceDetails,
  AmbulanceLocation,
  Provider,
  Hospital,
  HospitalDetails,
  AmbulanceInfo,
} from "../types";
import type { BookingStatus } from "../utils/constants";

export interface IPersistenceRepository {
  createBooking(data: BookingData): Promise<Booking>;
  getBooking(id: string): Promise<Booking | null>;
  updateBookingStatus(id: string, status: BookingStatus): Promise<void>;
  getAmbulance(ambulanceId: string): Promise<AmbulanceInfo | null>;
  assignAmbulance(id: string, ambulanceId: string): Promise<Booking>;
  findAvailableAmbulances(h3Indexes: string[]): Promise<AmbulanceDetails[]>;
  broadcastTripLocation(
    bookingId: string,
    location: AmbulanceLocation,
  ): Promise<void>;
  getAmbulanceProviderLocation(
    ambulanceId: string,
  ): Promise<{ lat: number; lng: number } | null>;
  getUserBookings(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]>;
  getConfirmedBookings(limit?: number, offset?: number): Promise<Booking[]>;
  searchProviders(raw: string, expanded: string): Promise<Provider[]>;
  findProvidersByH3Indexes(h3Indexes: string[]): Promise<Provider[]>;
  searchHospitals(raw: string, expanded: string): Promise<Hospital[]>;
  findHospitalsByH3Indexes(h3Indexes: string[]): Promise<HospitalDetails[]>;
}
