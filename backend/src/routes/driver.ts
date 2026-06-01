import { zValidator } from "@hono/zod-validator";
import { adminSimulationAdvanceSchema } from "../schemas";
import { createRouteApp } from "../utils/route";
import {
  ERROR_MESSAGES,
  errorResponse,
  validatorHook,
} from "../utils/constants";
import { isAdminRole } from "../utils/auth";

const driverApp = createRouteApp();

// POST /driver/ping - Admin-only simulation advancement
// Originally used for driver location pings; now repurposed for internal test/admin simulation control
// Accepts { bookingId: string, steps?: number (1-100) }
// Returns { bookingId: string, steps: number }
driverApp.post(
  "/ping",
  zValidator("json", adminSimulationAdvanceSchema, validatorHook),
  async (c) => {
    const body = c.req.valid("json");
    const { bookingId, steps } = body;

    const payload = c.get("jwtPayload");
    const isAdmin = isAdminRole(payload);

    if (!isAdmin) {
      return c.json(errorResponse(ERROR_MESSAGES.FORBIDDEN_ACCESS), 403);
    }

    const dispatchService = c.get("getDispatchService")();
    await dispatchService.advanceSimulation(bookingId, steps || 1);

    return c.json({ bookingId, steps: steps || 1 });
  },
);

export default driverApp;
