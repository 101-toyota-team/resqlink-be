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

  // NOTE: This implementation uses the Supabase REST Broadcast API 
  // (by calling send() without subscribe()), which is highly efficient 
  // for serverless environments by bypassing WebSocket handshakes.
  async broadcastTripLocation(
    bookingId: string,
    location: DriverLocation,
  ): Promise<void> {
    const channel = this.client.channel(`trip:${bookingId}`, {
      config: { broadcast: { ack: true } },
    });
    try {
      const resp = await channel.send({
        type: "broadcast",
        event: "location_update",
        payload: location,
      });
      if (resp !== "ok") {
        this.logger.warn("Failed to broadcast trip location", { status: resp });
      }
    } catch (err) {
      this.logger.error(err, "Error broadcasting trip location");
      throw err;
    } finally {
      await this.client.removeChannel(channel);
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
      const resp = await channel.send({
        type: "broadcast",
        event: "new_booking",
        payload: booking,
      });
      if (resp !== "ok") {
        this.logger.warn("Failed to broadcast new booking", { status: resp });
      }
    } catch (err) {
      this.logger.error(err, "Error broadcasting new booking");
      throw err;
    } finally {
      await this.client.removeChannel(channel);
    }
  }

  async broadcastAmbulanceAssigned(
    bookingId: string,
    booking: Booking,
  ): Promise<void> {
    const channel = this.client.channel(`trip:${bookingId}`, {
      config: { broadcast: { ack: true } },
    });
    try {
      const resp = await channel.send({
        type: "broadcast",
        event: "ambulance_assigned",
        payload: booking,
      });
      if (resp !== "ok") {
        this.logger.warn("Failed to broadcast ambulance assignment", { status: resp });
      }
    } catch (err) {
      this.logger.error(err, "Error broadcasting ambulance assignment");
      throw err;
    } finally {
      await this.client.removeChannel(channel);
    }
  }

  async broadcastStatusUpdated(
    bookingId: string,
    status: string,
  ): Promise<void> {
    const channel = this.client.channel(`trip:${bookingId}`, {
      config: { broadcast: { ack: true } },
    });
    try {
      const resp = await channel.send({
        type: "broadcast",
        event: "status_updated",
        payload: { status },
      });
      if (resp !== "ok") {
        this.logger.warn("Failed to broadcast status update", { status: resp });
      }
    } catch (err) {
      this.logger.error(err, "Error broadcasting status update");
      throw err;
    } finally {
      await this.client.removeChannel(channel);
    }
  }
}
