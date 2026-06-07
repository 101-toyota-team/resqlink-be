import { zValidator } from "@hono/zod-validator";
import {
  driverLocationSchema,
  driverStatusSchema,
  bookingIdParamSchema,
} from "../schemas";
import { createRouteApp } from "../utils/route";
import { validatorHook, ERROR_MESSAGES } from "../utils/constants";
import { isDriverRole } from "../utils/auth";
import { ForbiddenError } from "../utils/errors";

const driverApp = createRouteApp();

// POST /driver/location — Send GPS update from driver app
// Driver JWT required. Accepts { lat, lng, heading?, speed?, accuracy?, booking_id? }
// Writes to Redis cache + buffers to Supabase batch insert
driverApp.post(
  "/location",
  zValidator("json", driverLocationSchema, validatorHook),
  async (c) => {
    const body = c.req.valid("json");
    const payload = c.get("jwtPayload");
    if (!isDriverRole(payload))
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    const driverId = payload.sub;
    const driverService = c.get("getDriverService")();
    const driverLocationRepo = c.get("getDriverLocationRepo")();
    const waitUntil = c.executionCtx?.waitUntil?.bind(c.executionCtx);
    await driverService.updateLocation(driverId, body, waitUntil);
    if (c.executionCtx) {
      c.executionCtx.waitUntil(driverLocationRepo.flushBatch());
    } else {
      await driverLocationRepo.flushBatch();
    }
    return c.json({ status: "ok" }, 200);
  },
);

// GET /driver/assignments — Get active/pending bookings for this driver
driverApp.get("/assignments", async (c) => {
  const payload = c.get("jwtPayload");
  if (!isDriverRole(payload))
    throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
  const driverId = payload.sub;
  const driverService = c.get("getDriverService")();
  const bookings = await driverService.getAssignments(driverId);
  return c.json(bookings, 200);
});

// GET /bookings/:id/track — Get driver's latest location for a booking (user app endpoint)
// Note: mounted under /driver route prefix for auth consistency
driverApp.get(
  "/bookings/:id/track",
  zValidator("param", bookingIdParamSchema, validatorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const payload = c.get("jwtPayload");
    const bookingService = c.get("getBookingService")();
    const booking = await bookingService.getBooking(id, payload);
    if (!booking.driver_id) {
      return c.json({ location: null }, 200);
    }
    const driverLocationRepo = c.get("getDriverLocationRepo")();
    const location = await driverLocationRepo.getLatest(booking.driver_id);
    return c.json({ location }, 200);
  },
);

// PUT /driver/status — Go online/offline
driverApp.put(
  "/status",
  zValidator("json", driverStatusSchema, validatorHook),
  async (c) => {
    const { online } = c.req.valid("json");
    const payload = c.get("jwtPayload");
    if (!isDriverRole(payload))
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    const driverId = payload.sub;
    const driverService = c.get("getDriverService")();
    await driverService.setOnlineStatus(driverId, online);
    return c.json({ status: online ? "online" : "offline" }, 200);
  },
);

export default driverApp;
