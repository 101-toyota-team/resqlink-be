import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import { hospitalSearchSchema, hospitalNearbySchema } from "../schemas";
import { ERROR_MESSAGES, validatorHook } from "../utils/constants";
import logger from "../utils/logger";

const hospitalsApp = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

hospitalsApp.get(
  "/search",
  zValidator("query", hospitalSearchSchema, validatorHook),
  async (c) => {
    try {
      const { q } = c.req.valid("query");

      const hospitalService = c.get("getHospitalService")();
      const results = await hospitalService.searchHospitals(q);

      return c.json(results);
    } catch (error) {
      logger.error(error, "Hospitals search error");
      return c.json({ error: ERROR_MESSAGES.HOSPITALS_FAILED }, 500);
    }
  },
);

hospitalsApp.get(
  "/nearby",
  zValidator("query", hospitalNearbySchema, validatorHook),
  async (c) => {
    try {
      const { h3_index } = c.req.valid("query");

      const hospitalService = c.get("getHospitalService")();
      const results = await hospitalService.findNearbyHospitals(h3_index);

      return c.json(results);
    } catch (error) {
      logger.error(error, "Hospitals nearby error");
      return c.json({ error: ERROR_MESSAGES.HOSPITALS_FAILED }, 500);
    }
  },
);

export default hospitalsApp;