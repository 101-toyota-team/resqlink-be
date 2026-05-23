import { zValidator } from "@hono/zod-validator";
import { hospitalSearchSchema, hospitalNearbySchema } from "../schemas";
import { createRouteApp } from "../utils/route";
import {
  ERROR_MESSAGES,
  errorResponse,
  validatorHook,
} from "../utils/constants";
import logger from "../utils/logger";

const hospitalsApp = createRouteApp();

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
      return c.json(errorResponse(ERROR_MESSAGES.HOSPITALS_FAILED), 500);
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
      return c.json(errorResponse(ERROR_MESSAGES.HOSPITALS_FAILED), 500);
    }
  },
);

export default hospitalsApp;
