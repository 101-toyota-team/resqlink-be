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
      await channel.send({
        type: "broadcast",
        event: "new_booking",
        payload: booking,
      });
    } catch (err) {
      this.logger.error(err, "Failed to broadcast new booking");
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
      await channel.send({
        type: "broadcast",
        event: "ambulance_assigned",
        payload: booking,
      });
    } catch (err) {
      this.logger.error(err, "Failed to broadcast ambulance assignment");
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
      await channel.send({
        type: "broadcast",
        event: "status_updated",
        payload: { status },
      });
    } catch (err) {
      this.logger.error(err, "Failed to broadcast status update");
      throw err;
    } finally {
      await this.client.removeChannel(channel);
    }
  }
}
