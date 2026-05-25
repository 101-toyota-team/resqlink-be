import { zValidator } from "@hono/zod-validator";
import { nearbyAmbulancesSchema } from "../schemas";
import { createRouteApp } from "../utils/route";
import { DISCOVERY, validatorHook } from "../utils/constants";

const discoveryApp = createRouteApp();

discoveryApp.get(
  "/nearby",
  zValidator("query", nearbyAmbulancesSchema, validatorHook),
  async (c) => {
    const { h3_index, pickup } = c.req.valid("query");

    const dispatchService = c.get("getDispatchService")();
    const drivers = await dispatchService.findNearbyAmbulances(
      h3_index,
      DISCOVERY.H3_RING_RADIUS,
      pickup,
    );

    return c.json({
      center: h3_index,
      found_drivers: drivers,
    });
  },
);

export default discoveryApp;
