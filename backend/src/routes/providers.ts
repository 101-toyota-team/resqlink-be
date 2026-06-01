import { zValidator } from "@hono/zod-validator";
import { providerSearchSchema, providerNearbySchema } from "../schemas";
import { createRouteApp } from "../utils/route";
import { validatorHook } from "../utils/constants";
import { supabaseAuth } from "../middleware/auth";
import { isProviderRole, getProviderId } from "../utils/auth";
import {
  ERROR_MESSAGES,
  errorResponse,
  BOOKING_STATUSES,
} from "../utils/constants";
import { z } from "zod";

const providersApp = createRouteApp();

providersApp.get(
  "/search",
  zValidator("query", providerSearchSchema, validatorHook),
  async (c) => {
    const { q, limit } = c.req.valid("query");
    const providerService = c.get("getProviderService")();
    const results = await providerService.searchProviders(q, limit);
    return c.json(results);
  },
);

providersApp.get(
  "/nearby",
  zValidator("query", providerNearbySchema, validatorHook),
  async (c) => {
    const { h3_index, lat, lng } = c.req.valid("query");
    const providerService = c.get("getProviderService")();
    const results = await providerService.findNearbyProviders(
      h3_index,
      lat,
      lng,
    );
    return c.json(results);
  },
);

providersApp.get(
  "/:id/bookings",
  supabaseAuth,
  zValidator("param", z.object({ id: z.string().uuid() }), validatorHook),
  zValidator(
    "query",
    z.object({
      status: z.enum(BOOKING_STATUSES).optional(),
      limit: z.coerce.number().min(1).max(50).optional().default(10),
      offset: z.coerce.number().min(0).optional().default(0),
    }),
    validatorHook,
  ),
  async (c) => {
    const payload = c.get("jwtPayload");
    const { id: providerId } = c.req.valid("param");

    if (!isProviderRole(payload) || getProviderId(payload) !== providerId) {
      return c.json(errorResponse(ERROR_MESSAGES.FORBIDDEN_ACCESS), 403);
    }

    const { status, limit, offset } = c.req.valid("query");
    const bookingService = c.get("getBookingService")();

    const bookings = await bookingService.getBookingsByProvider(
      providerId,
      status,
      limit,
      offset,
    );

    return c.json(bookings);
  },
);

export default providersApp;
