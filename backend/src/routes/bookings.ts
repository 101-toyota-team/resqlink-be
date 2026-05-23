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
import {
  NotFoundError,
  ForbiddenError,
  BookingStateError,
} from "../services/bookings";

const bookingsApp = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

bookingsApp.get(
  "",
  zValidator("query", paginationSchema, validatorHook),
  async (c) => {
    try {
      const { limit, offset } = c.req.valid("query");
      const payload = c.get("jwtPayload");
      const bookingService = c.get("getBookingService")();
      const bookings = await bookingService.getUserBookings(
        payload.sub,
        limit,
        offset,
      );
      return c.json(bookings, 200);
    } catch (error) {
      logger.error(error, "Bookings GET / error");
      return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
    }
  },
);

bookingsApp.post(
  "",
  zValidator("json", bookingSchema, validatorHook),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const payload = c.get("jwtPayload");
      const bookingService = c.get("getBookingService")();
      const booking = await bookingService.createBooking(body, payload.sub);
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
      const payload = c.get("jwtPayload");
      const bookingService = c.get("getBookingService")();
      const booking = await bookingService.getBooking(id, payload);
      return c.json(booking, 200);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return c.json(errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND), 404);
      }
      if (error instanceof ForbiddenError) {
        return c.json(errorResponse(ERROR_MESSAGES.FORBIDDEN_ACCESS), 403);
      }
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
      const payload = c.get("jwtPayload");
      const bookingService = c.get("getBookingService")();
      const result = await bookingService.updateStatus(id, status, payload);
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return c.json(errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND), 404);
      }
      if (error instanceof ForbiddenError) {
        return c.json(errorResponse(ERROR_MESSAGES.FORBIDDEN_ACCESS), 403);
      }
      if (error instanceof BookingStateError) {
        return c.json(errorResponse(error.message), 400);
      }
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
      const payload = c.get("jwtPayload");
      const bookingService = c.get("getBookingService")();
      const booking = await bookingService.assignAmbulance(
        id,
        ambulance_id,
        payload,
      );
      return c.json(booking, 200);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return c.json(errorResponse("Ambulance or booking not found"), 404);
      }
      if (error instanceof ForbiddenError) {
        return c.json(errorResponse(error.message), 403);
      }
      if (error instanceof BookingStateError) {
        return c.json(errorResponse(error.message), 400);
      }
      logger.error(error, "Bookings PUT /:id/assign error");
      return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
    }
  },
);

export default bookingsApp;
