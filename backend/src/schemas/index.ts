import { z } from "zod";

export const nearbyAmbulancesSchema = z.object({
  h3_index: z.string().min(1, "h3_index is required"),
  pickup: z.string().optional(),
});

export const bookingSchema = z.object({
  ambulance_id: z.string().uuid(),
  booking_type: z.enum(["medical", "social"]),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  pickup_h3: z.string(),
  destination_lat: z.number().optional(),
  destination_lng: z.number().optional(),
});

export const driverPingSchema = z.object({
  driver_id: z.string().uuid(),
  h3_index: z.string(),
  previous_h3_index: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  heading: z.number().optional(),
  speed: z.number().optional(),
});
