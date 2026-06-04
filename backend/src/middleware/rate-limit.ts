import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types";
import type { Bindings } from "../schemas/env";
import { errorResponse } from "../utils/constants";

export function rateLimiter(
  bindingName: "RL_DEFAULT" | "RL_DRIVER" = "RL_DEFAULT",
): MiddlewareHandler<{ Bindings: Bindings; Variables: AppVariables }> {
  return async (c, next) => {
    const ip =
      c.req.raw.headers.get("cf-connecting-ip") ||
      c.req.raw.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const limiter = c.env ? c.env[bindingName] : undefined;

    // If the binding is missing (e.g., local tests), skip rate limiting
    if (!limiter || typeof limiter.limit !== "function") {
      await next();
      return;
    }

    try {
      const { success } = await limiter.limit({ key: ip });
      if (!success) {
        return c.json(errorResponse("Too many requests"), 429);
      }
    } catch (err) {
      const logger = c.get("getLogger")();
      logger.error("Native rate limiter error — allowing request", {
        bindingName,
        error: err,
      });
      await next();
      return;
    }

    await next();
  };
}
