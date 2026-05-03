import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { driverPingSchema } from "../schemas";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";
import { ERROR_MESSAGES } from "../utils/constants";

// Type guard to extract role from app_metadata
function getRoleFromMetadata(metadata: unknown): string | undefined {
  if (typeof metadata === "object" && metadata !== null) {
    const role = (metadata as Record<string, unknown>).role;
    if (typeof role === "string") {
      return role;
    }
  }
  return undefined;
}

const driverApp = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

driverApp.post("/ping", zValidator("json", driverPingSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const { driver_id, h3_index, previous_h3_index } = body;

    const payload = c.get("jwtPayload");
    const metadataRole = getRoleFromMetadata(payload.app_metadata);
    const isDriver = payload.role === "driver" || metadataRole === "driver";

    if (payload.sub !== driver_id || !isDriver) {
      return c.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, 403);
    }

    const dispatchService = c.get("getDispatchService")();
    await dispatchService.updateDriverStatus(
      driver_id,
      body,
      h3_index,
      previous_h3_index,
    );

    return c.json({ status: "ok" });
  } catch (error) {
    logger.error("Driver /ping error: %O", error);
    return c.json(
      { error: ERROR_MESSAGES.INTERNAL_ERROR },
      500,
    );
  }
});

export default driverApp;
