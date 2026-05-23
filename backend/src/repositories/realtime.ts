import { DriverLocation } from "../types";

export interface IRealtimeBroadcaster {
  broadcastTripLocation(
    bookingId: string,
    location: DriverLocation,
  ): Promise<void>;
}
