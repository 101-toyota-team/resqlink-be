import { IRealtimeBroadcaster } from "../../repositories/realtime";
import { SupabaseClientBase } from "./client";
import { AmbulanceLocation } from "../../types";

export class RealtimeBroadcaster
  extends SupabaseClientBase
  implements IRealtimeBroadcaster
{
  async broadcastTripLocation(
    bookingId: string,
    location: AmbulanceLocation,
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
}
