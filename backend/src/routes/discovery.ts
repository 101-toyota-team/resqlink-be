import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { nearbyAmbulancesSchema } from "../schemas";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";
import {
  ERROR_MESSAGES,
  errorResponse,
  validatorHook,
  DISCOVERY,
} from "../utils/constants";

const discoveryApp = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

discoveryApp.get(
  "/nearby",
  zValidator("query", nearbyAmbulancesSchema, validatorHook),
  async (c) => {
    try {
      const { h3_index, pickup } = c.req.valid("query");

      const dispatchService = c.get("getDispatchService")();
      const drivers = await dispatchService.findNearbyDrivers(
        h3_index,
        DISCOVERY.H3_RING_RADIUS,
        pickup,
      );

      return c.json({
        center: h3_index,
        found_drivers: drivers,
      });
    } catch (error) {
      logger.error({ error }, "Discovery /nearby error");
      return c.json(errorResponse(ERROR_MESSAGES.DISCOVERY_FAILED), 500);
    }
  },
);

export default discoveryApp;
