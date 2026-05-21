import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { driverPingSchema } from "../schemas";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";
import {
  ERROR_MESSAGES,
  errorResponse,
  validatorHook,
} from "../utils/constants";
import { isDriverRole } from "../utils/auth";

const driverApp = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

driverApp.get("/bookings", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const isDriver = isDriverRole(payload);

    if (!isDriver) {
      return c.json(errorResponse(ERROR_MESSAGES.FORBIDDEN_ACCESS), 403);
    }

    const db = c.get("getDb")();
    const bookings = await db.getConfirmedBookings();

    return c.json(bookings);
  } catch (error) {
    logger.error(error, "Driver /bookings error");
    return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
  }
});

driverApp.post(
  "/ping",
  zValidator("json", driverPingSchema, validatorHook),
  async (c) => {
    try {
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

      return c.json({ status: "ok" });
    } catch (error) {
      logger.error(error, "Driver /ping error");
      return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
    }
  },
);

export default driverApp;
