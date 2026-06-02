import { z } from "zod";
import { PROVIDER_TYPES } from "../types";
import { BOOKING_STATUSES } from "../utils/constants";

/**
 * Zod schemas for validating data returned from the Supabase/PostgreSQL database.
 * This acts as a runtime safety layer at the repository boundary.
 */

const nullToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .nullable()
    .optional()
    .transform((v) => v ?? undefined);

const dbViewportSchema = z.object({
  low: z.object({ lat: z.number(), lng: z.number() }),
  high: z.object({ lat: z.number(), lng: z.number() }),
});

const dbRouteLegSchema = z.object({
  sequence: z.number(),
  encoded_polyline: z.string(),
});

const dbRouteGeometrySchema = z.object({
  total_distance_meters: z.number(),
  total_duration_seconds: z.number(),
  combined_viewport: dbViewportSchema,
  legs: z.array(dbRouteLegSchema),
});

export const dbProviderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  h3_index: z.string(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  provider_type: z.enum(PROVIDER_TYPES),
  address: nullToUndefined(z.string()),
  phone: nullToUndefined(z.string()),
  created_at: z.string(),
});

export const dbHospitalSchema = z.object({
  id: z.string().uuid(),
  provider_id: z.string().uuid(),
  igd_phone: z.string(),
  igd_email: nullToUndefined(z.string()),
  bed_capacity: nullToUndefined(z.number()),
  specializations: nullToUndefined(z.array(z.string())),
  accreditation: nullToUndefined(z.string()),
  rating: z.number(),
  rating_count: z.number(),
  website_url: nullToUndefined(z.string()),
  providers: z.union([z.array(dbProviderSchema), dbProviderSchema]).optional(),
});

export const dbBookingSchema = z.object({
  id: z.string().uuid(),
  ambulance_id: z.string().uuid().nullable().optional(),
  provider_id: z.string().uuid().nullable().optional(),
  booking_type: z.enum(["medis", "sosial", "jenazah", "darurat"]),
  patient_condition: z.string(),
  pickup_address: z.string(),
  pickup_lat: z.coerce.number(),
  pickup_lng: z.coerce.number(),
  pickup_h3: z.string(),
  destination_address: z.string(),
  destination_lat: z.coerce.number(),
  destination_lng: z.coerce.number(),
  route_geometry: nullToUndefined(dbRouteGeometrySchema),
  user_id: z.string(),
  status: z.enum(BOOKING_STATUSES),
  created_at: z.string(),
});

export const dbAmbulanceDiscoverySchema = z.object({
  id: z.string().uuid(),
  providers: z.union([
    dbProviderSchema.pick({ latitude: true, longitude: true }),
    z.array(dbProviderSchema.pick({ latitude: true, longitude: true })),
  ]),
});

export const dbAmbulanceSchema = z.object({
  id: z.string().uuid(),
  provider_id: z.string().uuid(),
});

export const dbAmbulanceProviderSchema = z.object({
  providers: z
    .union([
      dbProviderSchema.pick({ latitude: true, longitude: true }),
      z.array(dbProviderSchema.pick({ latitude: true, longitude: true })),
    ])
    .nullable(),
});
