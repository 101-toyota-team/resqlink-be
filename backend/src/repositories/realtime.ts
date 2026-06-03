import { DriverLocation, Booking } from "../types";

export interface IRealtimeBroadcaster {
  broadcastTripLocation(
    bookingId: string,
    location: DriverLocation,
  ): Promise<void>;
  broadcastNewBooking(providerId: string, booking: Booking): Promise<void>;
}
