import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { bookingSchema } from "../schemas";
import { DispatchService } from "../services/dispatch";
import { SupabaseRepository } from "../infrastructure/supabase";

import { JwtPayload } from "../types";
import { Bindings } from "../schemas/env";

type Variables = {
  getDispatchService: () => DispatchService;
  getDb: () => SupabaseRepository;
  jwtPayload: JwtPayload;
};

const bookingsApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Use empty string to match the base path when mounted
bookingsApp.post("", zValidator("json", bookingSchema), async (c) => {
  const body = c.req.valid("json");
  const db = c.get("getDb")();
  const payload = c.get("jwtPayload");

  const bookingData = { ...body, user_id: payload.sub };
  const booking = await db.createBooking(bookingData);

  return c.json(booking, 201);
});

export default bookingsApp;
