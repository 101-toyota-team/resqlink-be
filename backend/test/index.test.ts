import { env } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";

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

  it("should rate limit /providers/* with RL_DEFAULT", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await app.request(
      "/providers/nearby?h3_index=8928308280fffff",
      {},
      { ...mockEnv, RL_DEFAULT: { limit } },
    );

    expect(limit).toHaveBeenCalled();
    expect(res.status).toBe(429);
  });

  it("should rate limit /hospitals/* with RL_DEFAULT", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await app.request(
      "/hospitals/nearby?h3_index=8928308280fffff",
      {},
      { ...mockEnv, RL_DEFAULT: { limit } },
    );

    expect(limit).toHaveBeenCalled();
    expect(res.status).toBe(429);
  });
});
