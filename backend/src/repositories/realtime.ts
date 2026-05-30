import { AmbulanceLocation, Booking } from "../types";

export interface IRealtimeBroadcaster {
  broadcastTripLocation(
    bookingId: string,
    location: AmbulanceLocation,
  ): Promise<void>;
  broadcastNewBooking(providerId: string, booking: Booking): Promise<void>;
}
