import { AmbulanceLocation } from "../types";

export interface IRealtimeBroadcaster {
  broadcastTripLocation(
    bookingId: string,
    location: AmbulanceLocation,
  ): Promise<void>;
}
