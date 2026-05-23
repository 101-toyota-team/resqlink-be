import { Hono } from "hono";
import { Bindings } from "../schemas/env";
import { AppVariables } from "../types";
import { ERROR_MESSAGES, errorResponse } from "./constants";
import logger from "./logger";

type AppEnv = { Bindings: Bindings; Variables: AppVariables };

export function createRouteApp() {
  return new Hono<AppEnv>();
}

export function catchHandler(
  error: unknown,
  c: { json: (data: unknown, status?: number) => Response },
) {
  logger.error(error, "Unhandled route error");
  return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
}
