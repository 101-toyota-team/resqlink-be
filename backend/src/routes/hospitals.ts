import { Hono } from "hono";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";
import { ERROR_MESSAGES } from "../utils/constants";

const hospitalsApp = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

hospitalsApp.get(
  "/search",
  async (c) => {
    try {
      const { q } = c.req.query();

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
  async (c) => {
    try {
      const h3_index = c.req.query("h3_index");
      if (!h3_index) {
        return c.json({ error: "h3_index is required" }, 400);
      }

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