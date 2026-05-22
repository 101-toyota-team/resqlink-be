import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  bookingSchema,
  bookingIdParamSchema,
  bookingStatusUpdateSchema,
  bookingAssignSchema,
  paginationSchema,
} from "../schemas";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";
import {
  ERROR_MESSAGES,
  errorResponse,
  validatorHook,
} from "../utils/constants";
import { canAccessBooking, unauthorizedResponse } from "../utils/auth";

const bookingsApp = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

bookingsApp.get(
  "",
  zValidator("query", paginationSchema, validatorHook),
  async (c) => {
    try {
      const { limit, offset } = c.req.valid("query");
      const db = c.get("getDb")();
      const payload = c.get("jwtPayload");

      const bookings = await db.getUserBookings(payload.sub, limit, offset);
      return c.json(bookings, 200);
    } catch (error) {
      logger.error(error, "Bookings GET / error");
      return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
    }
  },
);

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
      return c.json(errorResponse(ERROR_MESSAGES.BOOKING_FAILED), 500);
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
        return c.json(errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND), 404);
      }

      if (!canAccessBooking(payload, booking.user_id)) {
        return c.json(unauthorizedResponse(), 403);
      }

      return c.json(booking, 200);
    } catch (error) {
      logger.error(error, "Bookings GET /:id error");
      return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
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
        return c.json(errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND), 404);
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
      return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
    }
  },
);

bookingsApp.put(
  "/:id/assign",
  zValidator("param", bookingIdParamSchema, validatorHook),
  zValidator("json", bookingAssignSchema, validatorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const { ambulance_id } = c.req.valid("json");

      const db = c.get("getDb")();
      const payload = c.get("jwtPayload");

      const booking = await db.getBooking(id);
      if (!booking) {
        return c.json(errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND), 404);
      }

      if (!canAccessBooking(payload, booking.user_id)) {
        return c.json(unauthorizedResponse(), 403);
      }

      if (booking.status !== "draft") {
        return c.json(errorResponse("Booking is not in draft status"), 400);
      }

      const updatedBooking = await db.assignAmbulance(id, ambulance_id);

      return c.json(updatedBooking, 200);
    } catch (error) {
      logger.error(error, "Bookings PUT /:id/assign error");
      return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
    }
  },
);

export default bookingsApp;
