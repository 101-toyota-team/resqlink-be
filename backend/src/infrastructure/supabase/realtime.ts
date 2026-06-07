import { IRealtimeBroadcaster } from "../../repositories/realtime";
import { SupabaseClientBase } from "./client";
import { DriverLocation, Booking } from "../../types";
import type { ILogger } from "../../types";
import { RealtimeChannel } from "@supabase/supabase-js";

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
    const channel = this.client.channel(`trip:${bookingId}`, {
      config: { broadcast: { ack: true } },
    });
    try {
      await channel.send({
        type: "broadcast",
        event: "location_update",
        payload: location,
      });
    } catch (err) {
      this.logger.error(err, "Failed to broadcast trip location");
      throw err;
    } finally {
      this.client.removeChannel(channel);
    }
  }

  async broadcastNewBooking(
    providerId: string,
    booking: Booking,
  ): Promise<void> {
    const channel = this.client.channel(`provider:${providerId}`, {
      config: { broadcast: { ack: true } },
    });
    try {
      await channel.send({
        type: "broadcast",
        event: "new_booking",
        payload: booking,
      });
    } catch (err) {
      this.logger.error(err, "Failed to broadcast new booking");
      throw err;
    } finally {
      this.client.removeChannel(channel);
    }
  }
}
