import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const mockEnv = {
  ...env,
  ALLOWED_ORIGINS: "*",
  UPSTASH_REDIS_REST_URL: "http://localhost",
  UPSTASH_REDIS_REST_TOKEN: "test",
  SUPABASE_URL: "http://localhost",
  SUPABASE_SECRET_KEY: "test",
  MAPBOX_ACCESS_TOKEN: "test",
};
import app from "../src/index";

describe("ResQLink API", () => {
  it("should return 200 and the status message on GET /", async () => {
    const res = await app.request("/", {}, mockEnv);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ResQLink Robust API - Status: Online");
  });
});
