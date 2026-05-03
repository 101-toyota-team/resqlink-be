import { Hono } from "hono";
import { GoogleMapsRepository } from "../infrastructure/google-maps";
import { DispatchService } from "../services/dispatch";
import { SupabaseRepository } from "../infrastructure/supabase";

import { Bindings } from "../schemas/env";

type Variables = {
  getDispatchService: () => DispatchService;
  getDb: () => SupabaseRepository;
};

const hospitalsApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

hospitalsApp.get("/search", async (c) => {
  const query = c.req.query("query");
  if (!query) return c.json({ error: "query is required" }, 400);

  const mapsRepo = new GoogleMapsRepository(c.env.GOOGLE_MAPS_API_KEY);
  const results = await mapsRepo.searchPlaces(query);

  return c.json(results);
});

export default hospitalsApp;
