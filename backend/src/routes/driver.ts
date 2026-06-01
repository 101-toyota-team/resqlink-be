import { zValidator } from "@hono/zod-validator";
import { driverPingSchema } from "../schemas";
import { createRouteApp } from "../utils/route";
import {
  ERROR_MESSAGES,
  errorResponse,
  validatorHook,
} from "../utils/constants";
import { isDriverRole, getProviderId } from "../utils/auth";
import logger from "../utils/logger";

const driverApp = createRouteApp();

driverApp.get("/bookings", async (c) => {
  const payload = c.get("jwtPayload");
  const isDriver = isDriverRole(payload);

  if (!isDriver) {
    return c.json(errorResponse(ERROR_MESSAGES.FORBIDDEN_ACCESS), 403);
  }

  const providerId = getProviderId(payload);
  if (!providerId) {
    return c.json([], 200); // Or 403? Usually if they are a driver but have no provider, they see nothing.
  }
  const bookingRepo = c.get("getBookingRepo")();
  try {
    const bookings = await bookingRepo.getConfirmedBookings(
      providerId,
      payload.sub,
    );
    return c.json(bookings);
  } catch (error) {
    logger.error(error, "Error fetching confirmed bookings");
    return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
  }
});

driverApp.post(
  "/ping",
  zValidator("json", driverPingSchema, validatorHook),
  async (c) => {
    const body = c.req.valid("json");
    const { driver_id, lat, lng, h3_index, previous_h3_index } = body;

    const payload = c.get("jwtPayload");
    const isDriver = isDriverRole(payload);

    if (payload.sub !== driver_id || !isDriver) {
      return c.json(errorResponse(ERROR_MESSAGES.FORBIDDEN_ACCESS), 403);
    }

    const dispatchService = c.get("getDispatchService")();
    await dispatchService.updateDriverStatus(
      driver_id,
      { lat, lng },
      h3_index,
      previous_h3_index,
    );

    return c.json({ driver_id, lat, lng, h3_index, previous_h3_index });
  },
);

export default driverApp;
