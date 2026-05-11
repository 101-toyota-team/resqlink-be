import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  bookingSchema,
  bookingIdParamSchema,
  bookingStatusUpdateSchema,
} from "../schemas";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";
import { ERROR_MESSAGES, validatorHook } from "../utils/constants";
import { canAccessBooking, unauthorizedResponse } from "../utils/auth";

const bookingsApp = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// Use empty string to match the base path when mounted
bookingsApp.post(
  "",
  zValidator("json", bookingSchema, validatorHook),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const db = c.get("getDb")();
      const payload = c.get("jwtPayload");

      const bookingData = { ...body, user_id: payload.sub };
      const booking = await db.createBooking(bookingData);

      return c.json(booking, 201);
    } catch (error) {
      logger.error(error, "Bookings POST error");
      return c.json({ error: ERROR_MESSAGES.BOOKING_FAILED }, 500);
    }
  },
);

bookingsApp.get(
  "/:id",
  zValidator("param", bookingIdParamSchema, validatorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const db = c.get("getDb")();
      const payload = c.get("jwtPayload");

      const booking = await db.getBooking(id);
      if (!booking) {
        return c.json({ error: ERROR_MESSAGES.BOOKING_NOT_FOUND }, 404);
      }

      if (!canAccessBooking(payload, booking.user_id)) {
        return c.json(unauthorizedResponse(), 403);
      }

      return c.json(booking, 200);
    } catch (error) {
      logger.error(error, "Bookings GET /:id error");
      return c.json({ error: ERROR_MESSAGES.INTERNAL_ERROR }, 500);
    }
  },
);

bookingsApp.put(
  "/:id/status",
  zValidator("param", bookingIdParamSchema, validatorHook),
  zValidator("json", bookingStatusUpdateSchema, validatorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");

      const db = c.get("getDb")();
      const payload = c.get("jwtPayload");

      const booking = await db.getBooking(id);
      if (!booking) {
        return c.json({ error: ERROR_MESSAGES.BOOKING_NOT_FOUND }, 404);
      }

      if (!canAccessBooking(payload, booking.user_id)) {
        return c.json(unauthorizedResponse(), 403);
      }

      await db.updateBookingStatus(id, status);

      // If status is changed to en_route, start simulation
      if (status === "en_route") {
        const dispatchService = c.get("getDispatchService")();
        await dispatchService.startSimulationForBooking(booking, payload.sub);
      }

      return c.json({ status: "ok" }, 200);
    } catch (error) {
      logger.error(error, "Bookings PUT /:id/status error");
      return c.json({ error: ERROR_MESSAGES.INTERNAL_ERROR }, 500);
    }
  },
);

export default bookingsApp;
