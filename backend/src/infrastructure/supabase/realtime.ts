import { IRealtimeBroadcaster } from "../../repositories/realtime";
import { SupabaseClientBase } from "./client";
import { DriverLocation, Booking } from "../../types";
import type { ILogger } from "../../types";

export class RealtimeBroadcaster
  extends SupabaseClientBase
  implements IRealtimeBroadcaster
{
  constructor(url: string, key: string, logger: ILogger) {
    super(url, key, logger);
  }

  async broadcastTripLocation(
    bookingId: string,
    location: DriverLocation,
  ): Promise<void> {
    const channel = this.client.channel(`trip:${bookingId}`);
    try {
      await channel.send({
        type: "broadcast",
        event: "location_update",
        payload: location,
      });
    } finally {
      await this.client.removeChannel(channel);
    }
  }

  async broadcastNewBooking(
    providerId: string,
    booking: Booking,
  ): Promise<void> {
    const channel = this.client.channel(`provider:${providerId}`);
    try {
      await channel.send({
        type: "broadcast",
        event: "new_booking",
        payload: booking,
      });
    } finally {
      await this.client.removeChannel(channel);
    }
  }
}
