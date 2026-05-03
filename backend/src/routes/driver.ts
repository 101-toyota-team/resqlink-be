import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { driverPingSchema } from "../schemas";
import { DispatchService } from "../services/dispatch";
import { SupabaseRepository } from "../infrastructure/supabase";

import { JwtPayload } from "../types";
import { Bindings } from "../schemas/env";

type Variables = {
  getDispatchService: () => DispatchService;
  getDb: () => SupabaseRepository;
  jwtPayload: JwtPayload;
};

const driverApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

driverApp.post("/ping", zValidator("json", driverPingSchema), async (c) => {
  const body = c.req.valid("json");
  const { driver_id, h3_index, previous_h3_index } = body;

  const payload = c.get("jwtPayload");
  const isDriver =
    payload.role === "driver" || payload.app_metadata?.role === "driver";

  if (payload.sub !== driver_id || !isDriver) {
    return c.json({ error: "Unauthorized driver" }, 403);
  }

  const dispatchService = c.get("getDispatchService")();
  await dispatchService.updateDriverStatus(
    driver_id,
    body,
    h3_index,
    previous_h3_index,
  );

  return c.json({ status: "ok" });
});

export default driverApp;
