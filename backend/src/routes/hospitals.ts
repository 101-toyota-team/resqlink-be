import { Hono } from "hono";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";

const hospitalsApp = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

hospitalsApp.get("/search", async (c) => {
  const query = c.req.query("query");
  if (!query) return c.json({ error: "query is required" }, 400);

  const mapsRepo = c.get("getMaps")();
  const results = await mapsRepo.searchPlaces(query);

  return c.json(results);
});

export default hospitalsApp;
