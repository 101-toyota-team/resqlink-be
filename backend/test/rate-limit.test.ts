import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { rateLimiter } from "../src/middleware/rate-limit";
import type { AppVariables } from "../src/types";

interface RateLimiterBinding {
  limit: (opts: { key: string }) => Promise<{ success: boolean }>;
}

function createMockLimiter(limit: number) {
  let count = 0;
  const limitFn = vi.fn(async ({ key: _key }: { key: string }) => {
    count++;
    return { success: count <= limit };
  });

  return { limit: limitFn } as RateLimiterBinding;
}

function createApp(limit: number = 2) {
  const mockLimiter = createMockLimiter(limit);
  const app = new Hono<{
    Bindings: { RL_DEFAULT: RateLimiterBinding };
    Variables: AppVariables;
  }>();

  app.use("*", rateLimiter("RL_DEFAULT"));
  app.get("/test", (c) => c.json({ ok: true }));

  // Helper to make requests with the mock environment
  const request = (path: string, headers?: Record<string, string>) =>
    app.request(path, { headers }, { RL_DEFAULT: mockLimiter });

  return { app, mockLimiter, request };
}

describe("Rate Limiter Middleware (Native)", () => {
  it("should allow requests under the limit", async () => {
    const { request } = createApp(2);

    const res1 = await request("/test");
    expect(res1.status).toBe(200);

    const res2 = await request("/test");
    expect(res2.status).toBe(200);
  });

  it("should block requests exceeding the limit", async () => {
    const { request } = createApp(2);

    await request("/test");
    await request("/test");
    const res3 = await request("/test");

    expect(res3.status).toBe(429);
    const body = (await res3.json()) as { error: string };
    expect(body.error).toBe("Too many requests");
  });

  it("should respect per-IP isolation", async () => {
    const { request, mockLimiter } = createApp(2);

    const headersA = { "x-forwarded-for": "10.0.0.1" };
    await request("/test", headersA);

    expect(mockLimiter.limit).toHaveBeenCalledWith({ key: "10.0.0.1" });
  });

  it("should use cf-connecting-ip when present", async () => {
    const { request, mockLimiter } = createApp(2);

    const headers = { "cf-connecting-ip": "203.0.113.1" };
    await request("/test", headers);

    expect(mockLimiter.limit).toHaveBeenCalledWith({ key: "203.0.113.1" });
  });

  it("should fallback to 'unknown' when no IP headers are present", async () => {
    const { request, mockLimiter } = createApp(2);

    await request("/test");
    expect(mockLimiter.limit).toHaveBeenCalledWith({ key: "unknown" });
  });

  it("should fail-open if the limiter throws an error", async () => {
    const mockLimiter = {
      limit: vi.fn().mockRejectedValue(new Error("Redis Down")),
    } as RateLimiterBinding;
    const app = new Hono<{
      Bindings: { RL_DEFAULT: RateLimiterBinding };
      Variables: AppVariables;
    }>();

    app.use("*", rateLimiter("RL_DEFAULT"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {}, { RL_DEFAULT: mockLimiter });
    expect(res.status).toBe(200); // Fail-open
    expect(mockLimiter.limit).toHaveBeenCalled();
  });

  it("should skip if the binding is missing (e.g. local dev without config)", async () => {
    const app = new Hono<{
      Bindings: { RL_DEFAULT: RateLimiterBinding };
      Variables: AppVariables;
    }>();

    app.use("*", rateLimiter("RL_DEFAULT"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test"); // env is undefined here
    expect(res.status).toBe(200);
  });
});
