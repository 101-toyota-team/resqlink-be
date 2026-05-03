import { Hono } from "hono";
import { GoogleMapsRepository } from "../infrastructure/google-maps";
import { AppVariables } from "../types";
import { Bindings } from "../schemas/env";

const hospitalsApp = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

hospitalsApp.get("/search", async (c) => {
  const query = c.req.query("query");
  if (!query) return c.json({ error: "query is required" }, 400);

  // Still using the concretion here because it's simpler for a single call,
  // but let's make it consistent with DI if possible.
  // Actually, we could add a getMaps getter to AppVariables if we wanted to be perfectly SOLID.
  // For now, I'll just use the env to instantiate.
  const mapsRepo = new GoogleMapsRepository(c.env.GOOGLE_MAPS_API_KEY);
  const results = await mapsRepo.searchPlaces(query);

  return c.json(results);
});

export default hospitalsApp;
