import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types";
import { errorResponse } from "../utils/constants";
import logger from "../utils/logger";

export function rateLimiter(
  maxRequests: number = 30,
  windowSeconds: number = 60,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const ip =
      c.req.raw.headers.get("cf-connecting-ip") ||
      c.req.raw.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const key = `ratelimit:${ip}`;
    const cache = c.get("getCache")();
    let count: number;
    try {
      count = await cache.incr(key);
    } catch {
      logger.error("Rate limiter cache error — allowing request");
      await next();
      return;
    }

    if (count === 1) {
      await cache.expire(key, windowSeconds);
    }

    const ttl = await cache.ttl(key);
    const reset = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : 0);

    c.header("X-RateLimit-Limit", maxRequests.toString());
    c.header(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - count).toString(),
    );
    c.header("X-RateLimit-Reset", reset.toString());

    if (count > maxRequests) {
      return c.json(errorResponse("Too many requests"), 429);
    }
    await next();
  };
}
