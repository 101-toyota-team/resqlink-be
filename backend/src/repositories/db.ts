import {
  Booking,
  BookingData,
  DriverDetails,
  DriverLocation,
  Provider,
  Hospital,
  HospitalDetails,
} from "../types";

export interface IPersistenceRepository {
  createBooking(data: BookingData): Promise<Booking>;
  getBooking(id: string): Promise<Booking | null>;
  updateBookingStatus(id: string, status: string): Promise<void>;
  findAvailableAmbulances(h3Indexes: string[]): Promise<DriverDetails[]>;
  broadcastTripLocation(
    bookingId: string,
    location: DriverLocation,
  ): Promise<void>;
  getAmbulanceProviderLocation(
    ambulanceId: string,
  ): Promise<{ lat: number; lng: number } | null>;
  getConfirmedBookings(): Promise<Booking[]>;
  searchProviders(query: string): Promise<Provider[]>;
  findProvidersByH3Indexes(h3Indexes: string[]): Promise<Provider[]>;
  searchHospitals(query: string): Promise<Hospital[]>;
  findHospitalsByH3Indexes(h3Indexes: string[]): Promise<HospitalDetails[]>;
}
