/**
 * @deprecated This file is kept for backward compatibility.
 * Import focused classes from "./supabase/index" instead.
 * Each repository now lives in its own file under src/infrastructure/supabase/.
 *
 * Import replacements:
 *   BookingRepository       → import { BookingRepository }        from "./supabase/booking"
 *   AmbulanceRepository     → import { AmbulanceRepository }      from "./supabase/ambulance"
 *   ProviderRepository      → import { ProviderRepository }       from "./supabase/provider"
 *   HospitalRepository      → import { HospitalRepository }       from "./supabase/hospital"
 *   RealtimeBroadcaster     → import { RealtimeBroadcaster }      from "./supabase/realtime"
 *
 * This backward-compatible wrapper will be removed once all consumers
 * have been migrated to the focused imports (tasks T10, T13).
 */

import type { IBookingRepository } from "../repositories/booking";
import type { IAmbulanceRepository } from "../repositories/ambulance";
import type { IProviderRepository } from "../repositories/provider";
import type { IHospitalRepository } from "../repositories/hospital";
import type { IRealtimeBroadcaster } from "../repositories/realtime";
import type {
  Booking,
  BookingData,
  AmbulanceInfo,
  AmbulanceDetails,
  AmbulanceLocation,
  Provider,
  Hospital,
  HospitalDetails,
} from "../types";
import type { BookingStatus } from "../utils/constants";
import { BookingRepository } from "./supabase/booking";
import { AmbulanceRepository } from "./supabase/ambulance";
import { ProviderRepository } from "./supabase/provider";
import { HospitalRepository } from "./supabase/hospital";
import { RealtimeBroadcaster } from "./supabase/realtime";

// Re-export focused classes for convenience
export {
  BookingRepository,
  AmbulanceRepository,
  ProviderRepository,
  HospitalRepository,
  RealtimeBroadcaster,
};

/**
 * Backward-compatible combined repository that delegates to the 5 focused
 * implementations. Each sub-repository manages its own Supabase client
 * (separate connections, but functionally identical under the hood).
 */
export class SupabaseRepository
  implements
    IBookingRepository,
    IAmbulanceRepository,
    IProviderRepository,
    IHospitalRepository,
    IRealtimeBroadcaster
{
  private bookingRepo: BookingRepository;
  private ambulanceRepo: AmbulanceRepository;
  private providerRepo: ProviderRepository;
  private hospitalRepo: HospitalRepository;
  private realtimeRepo: RealtimeBroadcaster;

  constructor(url: string, key: string) {
    this.bookingRepo = new BookingRepository(url, key);
    this.ambulanceRepo = new AmbulanceRepository(url, key);
    this.providerRepo = new ProviderRepository(url, key);
    this.hospitalRepo = new HospitalRepository(url, key);
    this.realtimeRepo = new RealtimeBroadcaster(url, key);
  }

  // --- IBookingRepository ---

  createBooking(data: BookingData): Promise<Booking> {
    return this.bookingRepo.createBooking(data);
  }

  getBooking(id: string): Promise<Booking | null> {
    return this.bookingRepo.getBooking(id);
  }

  assignAmbulance(id: string, ambulanceId: string): Promise<Booking> {
    return this.bookingRepo.assignAmbulance(id, ambulanceId);
  }

  updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
    return this.bookingRepo.updateBookingStatus(id, status);
  }

  getUserBookings(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    return this.bookingRepo.getUserBookings(userId, limit, offset);
  }

  getConfirmedBookings(
    providerId: string,
    driverId?: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    return this.bookingRepo.getConfirmedBookings(
      providerId,
      driverId,
      limit,
      offset,
    );
  }

  getBookingsByProvider(
    providerId: string,
    status?: BookingStatus,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    return this.bookingRepo.getBookingsByProvider(
      providerId,
      status,
      limit,
      offset,
    );
  }

  // --- IAmbulanceRepository ---

  getAmbulance(ambulanceId: string): Promise<AmbulanceInfo | null> {
    return this.ambulanceRepo.getAmbulance(ambulanceId);
  }

  findAvailableAmbulances(h3Indexes: string[]): Promise<AmbulanceDetails[]> {
    return this.ambulanceRepo.findAvailableAmbulances(h3Indexes);
  }

  getAmbulanceProviderLocation(
    ambulanceId: string,
  ): Promise<{ lat: number; lng: number } | null> {
    return this.ambulanceRepo.getAmbulanceProviderLocation(ambulanceId);
  }

  // --- IProviderRepository ---

  searchProviders(
    raw: string,
    expanded: string,
    limit?: number,
  ): Promise<Provider[]> {
    return this.providerRepo.searchProviders(raw, expanded, limit);
  }

  findProvidersByH3Indexes(h3Indexes: string[]): Promise<Provider[]> {
    return this.providerRepo.findProvidersByH3Indexes(h3Indexes);
  }

  // --- IHospitalRepository ---

  searchHospitals(
    raw: string,
    expanded: string,
    limit?: number,
  ): Promise<Hospital[]> {
    return this.hospitalRepo.searchHospitals(raw, expanded, limit);
  }

  findHospitalsByH3Indexes(h3Indexes: string[]): Promise<HospitalDetails[]> {
    return this.hospitalRepo.findHospitalsByH3Indexes(h3Indexes);
  }

  // --- IRealtimeBroadcaster ---

  broadcastTripLocation(
    bookingId: string,
    location: AmbulanceLocation,
  ): Promise<void> {
    return this.realtimeRepo.broadcastTripLocation(bookingId, location);
  }

  broadcastNewBooking(providerId: string, booking: Booking): Promise<void> {
    return this.realtimeRepo.broadcastNewBooking(providerId, booking);
  }
}
