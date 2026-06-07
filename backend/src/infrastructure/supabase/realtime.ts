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

  private async subscribe(channelName: string): Promise<import("@supabase/supabase-js").RealtimeChannel> {
    const channel = this.client.channel(channelName);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.client.removeChannel(channel);
        reject(new Error("Subscription timed out"));
      }, 5000);

      channel.subscribe((status) => {
        clearTimeout(timeout);
        if (status === "SUBSCRIBED") {
          resolve(channel);
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "CLOSED" ||
          status === "TIMED_OUT"
        ) {
          this.client.removeChannel(channel);
          reject(new Error(`Subscription failed with status: ${status}`));
        }
      });
    });
  }

  async broadcastTripLocation(
    bookingId: string,
    location: DriverLocation,
  ): Promise<void> {
    const channelName = `trip:${bookingId}`;
    const channel = await this.subscribe(channelName);
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
    const channelName = `provider:${providerId}`;
    const channel = await this.subscribe(channelName);
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
