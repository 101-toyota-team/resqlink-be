import {
  Booking,
  BookingData,
  DriverDetails,
  DriverLocation,
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
  findAvailableAmbulances(h3Indexes: string[]): Promise<DriverDetails[]>;
  broadcastTripLocation(
    bookingId: string,
    location: DriverLocation,
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
  searchHospitals(query: string): Promise<Hospital[]>;
  findHospitalsByH3Indexes(h3Indexes: string[]): Promise<HospitalDetails[]>;
}
