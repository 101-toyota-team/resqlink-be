import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types";
import { errorResponse } from "../utils/constants";
import logger from "../utils/logger";

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
    let count: number;
    try {
      count = await cache.incr(key);
    } catch {
      logger.error("Rate limiter cache error — allowing request");
      await next();
      return;
    }

    if (count === 1) {
      await cache.expire(key, WINDOW_SECONDS);
    }

    if (count > maxRequests) {
      return c.json(errorResponse("Too many requests"), 429);
    }
    await next();
  };
}
