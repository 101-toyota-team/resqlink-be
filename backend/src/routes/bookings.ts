import { zValidator } from "@hono/zod-validator";
import {
  bookingSchema,
  bookingIdParamSchema,
  bookingStatusUpdateSchema,
  bookingAssignSchema,
  paginationSchema,
} from "../schemas";
import { createRouteApp } from "../utils/route";
import { validatorHook } from "../utils/constants";

const bookingsApp = createRouteApp();

bookingsApp.get(
  "",
  zValidator("query", paginationSchema, validatorHook),
  async (c) => {
    const { limit, offset } = c.req.valid("query");
    const payload = c.get("jwtPayload");
    const bookingService = c.get("getBookingService")();
    const bookings = await bookingService.getUserBookings(
      payload.sub,
      limit,
      offset,
    );
    return c.json(bookings, 200);
  },
);

bookingsApp.post(
  "",
  zValidator("json", bookingSchema, validatorHook),
  async (c) => {
    const body = c.req.valid("json");
    const payload = c.get("jwtPayload");
    const bookingService = c.get("getBookingService")();
    const booking = await bookingService.createBooking(body, payload.sub);
    return c.json(booking, 201);
  },
);

bookingsApp.get(
  "/:id",
  zValidator("param", bookingIdParamSchema, validatorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const payload = c.get("jwtPayload");
    const bookingService = c.get("getBookingService")();
    const booking = await bookingService.getBooking(id, payload);
    return c.json(booking, 200);
  },
);

bookingsApp.put(
  "/:id/status",
  zValidator("param", bookingIdParamSchema, validatorHook),
  zValidator("json", bookingStatusUpdateSchema, validatorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const payload = c.get("jwtPayload");
    const bookingService = c.get("getBookingService")();
    const booking = await bookingService.updateStatus(id, status, payload);
    return c.json(booking, 200);
  },
);

bookingsApp.put(
  "/:id/assign",
  zValidator("param", bookingIdParamSchema, validatorHook),
  zValidator("json", bookingAssignSchema, validatorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const { ambulance_id, driver_id } = c.req.valid("json");
    const payload = c.get("jwtPayload");
    const bookingService = c.get("getBookingService")();
    const booking = await bookingService.assignAmbulance(
      id,
      ambulance_id,
      payload,
      driver_id,
    );
    return c.json(booking, 200);
  },
);

export default bookingsApp;
