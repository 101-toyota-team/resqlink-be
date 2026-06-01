import { env } from "cloudflare:test";
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

describe("Integration Tests", () => {
  it("should return 200 on root endpoint", async () => {
    const res = await app.request("/", {}, mockEnv);
    expect(res.status).toBe(200);
  });

  it("should return 404 on unknown route", async () => {
    const res = await app.request("/unknown-route", {}, mockEnv);
    expect(res.status).toBe(404);
  });
});
