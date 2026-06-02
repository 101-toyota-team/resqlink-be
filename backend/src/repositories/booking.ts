import { Booking, BookingData } from "../types";
import type { BookingStatus } from "../utils/constants";

export interface IBookingRepository {
  createBooking(data: BookingData): Promise<Booking>;
  getBooking(id: string): Promise<Booking | null>;
  updateBookingStatus(id: string, status: BookingStatus): Promise<void>;
  assignAmbulance(
    id: string,
    ambulanceId: string,
    providerId?: string,
    routeGeometry?: any,
  ): Promise<Booking>;
  getUserBookings(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]>;
  getConfirmedBookings(
    providerId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]>;
  getBookingsByProvider(
    providerId: string,
    status?: BookingStatus,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]>;
}
