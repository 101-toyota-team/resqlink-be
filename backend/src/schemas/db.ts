import { z } from "zod";

/**
 * Zod schemas for validating data returned from the Supabase/PostgreSQL database.
 * This acts as a runtime safety layer at the repository boundary.
 */

export const dbProviderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  h3_index: z.string(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  provider_type: z.string(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  created_at: z.string(),
});

export const dbHospitalSchema = z.object({
  id: z.string().uuid(),
  provider_id: z.string().uuid(),
  igd_phone: z.string(),
  igd_email: z.string().nullable().optional(),
  bed_capacity: z.number().nullable().optional(),
  specializations: z.array(z.string()).nullable().optional(),
  accreditation: z.string().nullable().optional(),
  rating: z.number(),
  rating_count: z.number(),
  website_url: z.string().nullable().optional(),
  providers: z.union([z.array(dbProviderSchema), dbProviderSchema]).optional(),
});

export const dbBookingSchema = z.object({
  id: z.string().uuid(),
  ambulance_id: z.string().uuid(),
  booking_type: z.enum(["medis", "sosial", "jenazah", "darurat"]),
  patient_condition: z.string(),
  pickup_address: z.string(),
  pickup_lat: z.coerce.number(),
  pickup_lng: z.coerce.number(),
  pickup_h3: z.string(),
  destination_address: z.string(),
  destination_lat: z.coerce.number(),
  destination_lng: z.coerce.number(),
  user_id: z.string(),
  status: z.string(),
  created_at: z.string(),
});

export const dbAmbulanceDiscoverySchema = z.object({
  id: z.string().uuid(),
  providers: z.union([
    dbProviderSchema.pick({ latitude: true, longitude: true }),
    z.array(dbProviderSchema.pick({ latitude: true, longitude: true })),
  ]),
});

export const dbAmbulanceProviderSchema = z.object({
  providers: z
    .union([
      dbProviderSchema.pick({ latitude: true, longitude: true }),
      z.array(dbProviderSchema.pick({ latitude: true, longitude: true })),
    ])
    .nullable(),
});
