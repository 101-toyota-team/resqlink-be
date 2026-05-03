import { Hono } from "hono";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";
import { ERROR_MESSAGES } from "../utils/constants";

const hospitalsApp = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

hospitalsApp.get("/search", async (c) => {
  try {
    const query = c.req.query("query");
    if (!query) return c.json({ error: "query is required" }, 400);

    const mapsRepo = c.get("getMaps")();
    const results = await mapsRepo.searchPlaces(query);

    return c.json(results);
  } catch (error) {
    logger.error("Hospitals /search error: %O", error);
    return c.json(
      { error: ERROR_MESSAGES.HOSPITALS_FAILED },
      500,
    );
  }
});

export default hospitalsApp;
