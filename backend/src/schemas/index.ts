import { z } from "zod";
import * as h3 from "h3-js";
import { BOOKING_STATUSES } from "../utils/constants";

const h3IndexSchema = z.string().refine(
  (val) => {
    try {
      return h3.isValidCell(val) && h3.getResolution(val) === 7;
    } catch {
      return false;
    }
  },
  { message: "Invalid H3 index" },
);

/**
 * Coerces a value to a number, but returns undefined if it's an empty string or null.
 * This prevents URL query params like ?lat=&lng= from being coerced to 0 (Null Island).
 */
const coerceOptionalNumber = (min: number, max: number) =>
  z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number().min(min).max(max).optional());

export const nearbyAmbulancesSchema = z.object({
  h3_index: h3IndexSchema,
  pickup: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const parts = val.split(",");
      if (parts.length !== 2) return false;
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      return (
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    }, "Invalid pickup format — expected lat,lng (e.g. -6.2,106.8)"),
});

export const bookingSchema = z.object({
  ambulance_id: z.string().uuid().optional(),
  booking_type: z.enum(["medis", "sosial", "jenazah", "darurat"]),
  patient_condition: z.string(),
  pickup_address: z.string(),
  pickup_lat: z.number().min(-90).max(90),
  pickup_lng: z.number().min(-180).max(180),
  pickup_h3: h3IndexSchema,
  destination_address: z.string(),
  destination_lat: z.number().min(-90).max(90),
  destination_lng: z.number().min(-180).max(180),
});

export const driverPingSchema = z.object({
  driver_id: z.string().uuid(),
  h3_index: h3IndexSchema,
  previous_h3_index: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters").max(256),
});

export const hospitalSearchSchema = searchQuerySchema;

export const hospitalNearbySchema = z.object({
  h3_index: h3IndexSchema,
});

export const providerSearchSchema = searchQuerySchema;

export const providerNearbySchema = z.object({
  h3_index: h3IndexSchema,
  lat: coerceOptionalNumber(-90, 90),
  lng: coerceOptionalNumber(-180, 180),
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid("Invalid booking ID format"),
});

export const bookingAssignSchema = z.object({
  ambulance_id: z.string().uuid(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const bookingStatusUpdateSchema = z.object({
  status: z.enum(BOOKING_STATUSES, {
    errorMap: () => ({ message: "Invalid status value" }),
  }),
});
