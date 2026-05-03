import { Booking, BookingData } from "../types";

export interface IPersistenceRepository {
  createBooking(data: BookingData): Promise<Booking>;
  getBooking(id: string): Promise<Booking | null>;
  updateBookingStatus(id: string, status: string): Promise<void>;
  // Add other methods as needed (e.g. getHospitals, getAmbulanceDetails)
}
