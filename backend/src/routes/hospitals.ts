import { zValidator } from "@hono/zod-validator";
import { hospitalSearchSchema, hospitalNearbySchema } from "../schemas";
import { createRouteApp } from "../utils/route";
import { validatorHook } from "../utils/constants";

const hospitalsApp = createRouteApp();

hospitalsApp.get(
  "/search",
  zValidator("query", hospitalSearchSchema, validatorHook),
  async (c) => {
    const { q, limit } = c.req.valid("query");
    const hospitalService = c.get("getHospitalService")();
    const results = await hospitalService.searchHospitals(q, limit);
    return c.json(results);
  },
);

hospitalsApp.get(
  "/nearby",
  zValidator("query", hospitalNearbySchema, validatorHook),
  async (c) => {
    const { h3_index } = c.req.valid("query");
    const hospitalService = c.get("getHospitalService")();
    const results = await hospitalService.findNearbyHospitals(h3_index);
    return c.json(results);
  },
);

export default hospitalsApp;
