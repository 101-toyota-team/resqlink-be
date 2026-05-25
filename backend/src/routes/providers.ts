import { zValidator } from "@hono/zod-validator";
import { providerSearchSchema, providerNearbySchema } from "../schemas";
import { createRouteApp } from "../utils/route";
import { validatorHook } from "../utils/constants";

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

export default providersApp;
