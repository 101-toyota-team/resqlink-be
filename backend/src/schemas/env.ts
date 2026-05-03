import { z } from "zod";

export const envSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  GOOGLE_MAPS_API_KEY: z.string().min(1),
});

export type Bindings = z.infer<typeof envSchema>;
