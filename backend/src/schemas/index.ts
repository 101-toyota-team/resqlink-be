import { z } from "zod";

export const nearbyAmbulancesSchema = z.object({
  h3_index: z.string().min(1, "h3_index is required"),
  pickup: z.string().optional(),
});

export const bookingSchema = z.object({
  ambulance_id: z.string().uuid(),
  booking_type: z.enum(["medis", "sosial", "jenazah", "darurat"]),
  patient_condition: z.string(),
  pickup_address: z.string(),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  pickup_h3: z.string(),
  destination_address: z.string(),
  destination_lat: z.number(),
  destination_lng: z.number(),
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

// Hospital search endpoint validation - standardized to use 'q' like providers
export const hospitalSearchSchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters").max(256),
});

export const hospitalNearbySchema = z.object({
  h3_index: z.string().min(1, "h3_index is required"),
});

export const providerSearchSchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters").max(256),
});

export const providerNearbySchema = z.object({
  h3_index: z.string().min(1, "h3_index is required"),
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid("Invalid booking ID format"),
});

export const bookingStatusUpdateSchema = z.object({
  status: z.enum(
    [
      "confirmed",
      "en_route",
      "arrived",
      "to_hospital",
      "completed",
      "cancelled",
    ],
    { errorMap: () => ({ message: "Invalid status value" }) },
  ),
});