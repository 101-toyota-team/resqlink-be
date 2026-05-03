import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { bookingSchema } from "../schemas";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";
import { ERROR_MESSAGES } from "../utils/constants";

const bookingsApp = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// Use empty string to match the base path when mounted
bookingsApp.post("", zValidator("json", bookingSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("getDb")();
    const payload = c.get("jwtPayload");

    const bookingData = { ...body, user_id: payload.sub };
    const booking = await db.createBooking(bookingData);

    return c.json(booking, 201);
  } catch (error) {
    logger.error("Bookings POST error: %O", error);
    return c.json(
      { error: ERROR_MESSAGES.BOOKING_FAILED },
      500,
    );
  }
});

export default bookingsApp;
