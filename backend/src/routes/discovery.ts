import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { nearbyAmbulancesSchema } from "../schemas";
import { DispatchService } from "../services/dispatch";
import { SupabaseRepository } from "../infrastructure/supabase";

import { JwtPayload } from "../types";
import { Bindings } from "../schemas/env";

type Variables = {
  getDispatchService: () => DispatchService;
  getDb: () => SupabaseRepository;
  jwtPayload: JwtPayload;
};

const discoveryApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

discoveryApp.get(
  "/nearby",
  zValidator("query", nearbyAmbulancesSchema),
  async (c) => {
    const { h3_index, pickup } = c.req.valid("query");

    const dispatchService = c.get("getDispatchService")();
    const drivers = await dispatchService.findNearbyDrivers(
      h3_index,
      1,
      pickup,
    );

    return c.json({
      center: h3_index,
      found_drivers: drivers,
    });
  },
);

export default discoveryApp;
