import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { AppVariables } from "../types";
import { providerSearchSchema, providerNearbySchema } from "../schemas";
import { ERROR_MESSAGES, validatorHook } from "../utils/constants";
import logger from "../utils/logger";

const providersApp = new Hono<{ Variables: AppVariables }>();

providersApp.get(
  "/search",
  zValidator("query", providerSearchSchema, validatorHook),
  async (c) => {
    try {
      const { q } = c.req.valid("query");
      const providerService = c.get("getProviderService")();
      const results = await providerService.searchProviders(q);
      return c.json(results);
    } catch (error) {
      logger.error(error, "Error searching providers");
      return c.json({ error: ERROR_MESSAGES.INTERNAL_ERROR }, 500);
    }
  },
);

providersApp.get(
  "/nearby",
  zValidator("query", providerNearbySchema, validatorHook),
  async (c) => {
    try {
      const { h3_index, lat, lng, page, per_page } = c.req.valid("query");
      const providerService = c.get("getProviderService")();
      const results = await providerService.findNearbyProviders(
        h3_index,
        lat,
        lng,
        page,
        per_page,
      );
      return c.json(results);
    } catch (error) {
      logger.error(error, "Error finding nearby providers");
      return c.json({ error: ERROR_MESSAGES.INTERNAL_ERROR }, 500);
    }
  },
);

export default providersApp;
