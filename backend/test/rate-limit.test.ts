import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { rateLimiter } from "../src/middleware/rate-limit";
import type { AppVariables } from "../src/types";
import type { ICacheRepository } from "../src/repositories/cache";

function createMockCache() {
  const store = new Map<string, number>();
  const incr = vi.fn(async (key: string): Promise<number> => {
    const next = (store.get(key) ?? 0) + 1;
    store.set(key, next);
    return next;
  });
  const expire = vi.fn();

  const cache = {
    getDriversInBucket: vi.fn(),
    updateDriverLocation: vi.fn(),
    getDriverLocation: vi.fn(),
    getDriverLocations: vi.fn(),
    addDriverToBucket: vi.fn(),
    removeDriverFromBucket: vi.fn(),
    mget: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    incr,
    expire,
    del: vi.fn(),
  } as unknown as ICacheRepository;

  return { cache, incrMock: incr, expireMock: expire };
}

function createApp(maxRequests?: number) {
  const { cache, incrMock, expireMock } = createMockCache();
  const app = new Hono<{ Variables: AppVariables }>();

  app.use("*", async (c, next) => {
    c.set("getCache", () => cache);
    await next();
  });

  app.use("*", rateLimiter(maxRequests));
  app.get("/test", (c) => c.json({ ok: true }));

  return { app, cache, incrMock, expireMock };
}

describe("Rate Limiter Middleware", () => {
  it("should allow requests under the limit", async () => {
    const { app } = createApp(2);

    const res1 = await app.request("/test");
    expect(res1.status).toBe(200);

    const res2 = await app.request("/test");
    expect(res2.status).toBe(200);
  });

  it("should block requests exceeding the limit", async () => {
    const { app } = createApp(2);

    await app.request("/test");
    await app.request("/test");
    const res3 = await app.request("/test");

    expect(res3.status).toBe(429);
    const body = (await res3.json()) as { error: string };
    expect(body.error).toBe("Too many requests");
  });

  it("should respect per-IP isolation via x-forwarded-for", async () => {
    const { app } = createApp(2);

    // Make 3 requests from IP A, 1 from IP B
    const headersA = { "x-forwarded-for": "10.0.0.1" };
    const headersB = { "x-forwarded-for": "10.0.0.2" };

    await app.request("/test", { headers: headersA });
    await app.request("/test", { headers: headersA });
    await app.request("/test", { headers: headersA }); // Blocked for A

    const resA = await app.request("/test", { headers: headersA });
    expect(resA.status).toBe(429);

    const resB = await app.request("/test", { headers: headersB });
    expect(resB.status).toBe(200);
  });

  it("should use cf-connecting-ip when x-forwarded-for is not present", async () => {
    const { app } = createApp(1);

    const headers = { "cf-connecting-ip": "203.0.113.1" };
    const res1 = await app.request("/test", { headers });
    expect(res1.status).toBe(200);

    const res2 = await app.request("/test", { headers });
    expect(res2.status).toBe(429);
  });

  it("should fallback to 'unknown' when no IP headers are present", async () => {
    const { app, incrMock } = createApp(1);

    await app.request("/test");
    const res2 = await app.request("/test");
    expect(res2.status).toBe(429);

    expect(incrMock).toHaveBeenCalledWith("ratelimit:unknown");
  });

  it("should set TTL only on the first request in a window", async () => {
    const { app, incrMock, expireMock } = createApp(3);

    await app.request("/test");
    await app.request("/test");
    await app.request("/test");
    const res4 = await app.request("/test"); // blocked

    expect(res4.status).toBe(429);
    // incr is called for all 4 requests (4th returns 4, then blocked)
    expect(incrMock).toHaveBeenCalledTimes(4);
    // expire only called on the first incr (count === 1)
    expect(expireMock).toHaveBeenCalledTimes(1);
    expect(expireMock).toHaveBeenCalledWith("ratelimit:unknown", 60);
  });
});
