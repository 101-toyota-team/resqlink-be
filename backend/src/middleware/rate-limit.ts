import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types";

const WINDOW_SECONDS = 60;

export function rateLimiter(
  maxRequests: number = 30,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const ip =
      c.req.raw.headers.get("cf-connecting-ip") ||
      c.req.raw.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const key = `ratelimit:${ip}`;
    const cache = c.get("getCache")();
    const count = (await cache.get<number>(key)) ?? 0;

    if (count >= maxRequests) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await cache.set(key, count + 1, WINDOW_SECONDS);
    await next();
  };
}
