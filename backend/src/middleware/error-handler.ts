import type { ErrorHandler } from "hono";
import {
  NotFoundError,
  ForbiddenError,
  BookingStateError,
  ValidationError,
} from "../utils/errors";
import { ERROR_MESSAGES, errorResponse } from "../utils/constants";
import { Logger } from "../utils/logger";

export const errorHandler: ErrorHandler = (err, c) => {
  let logger;
  try {
    const getLogger = c.get("getLogger");
    logger = typeof getLogger === "function" ? getLogger() : new Logger(c?.env?.LOG_LEVEL || "info");
  } catch {
    logger = new Logger(c?.env?.LOG_LEVEL || "info");
  }

  if (err instanceof NotFoundError) {
    logger.info("Not found", { errorType: "NotFoundError" });
    return c.json(errorResponse(err.message), 404);
  }
  if (err instanceof ForbiddenError) {
    logger.warn("Forbidden access", { errorType: "ForbiddenError" });
    return c.json(errorResponse(err.message), 403);
  }
  if (err instanceof BookingStateError) {
    logger.warn("Invalid booking state", { errorType: "BookingStateError" });
    return c.json(errorResponse(err.message), 400);
  }
  if (err instanceof ValidationError) {
    logger.warn("Validation error", { errorType: "ValidationError" });
    return c.json(errorResponse(err.message), 400);
  }

  logger.error("Internal server error", err, {
    method: c.req.method,
    path: c.req.path,
    requestId: c.get("requestId"),
  });
  return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
};
