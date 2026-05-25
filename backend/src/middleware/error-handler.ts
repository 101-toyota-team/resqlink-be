import type { ErrorHandler } from "hono";
import {
  NotFoundError,
  ForbiddenError,
  BookingStateError,
} from "../utils/errors";
import { ERROR_MESSAGES, errorResponse } from "../utils/constants";
import logger from "../utils/logger";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof NotFoundError) {
    return c.json(errorResponse(err.message), 404);
  }
  if (err instanceof ForbiddenError) {
    return c.json(errorResponse(err.message), 403);
  }
  if (err instanceof BookingStateError) {
    return c.json(errorResponse(err.message), 400);
  }

  logger.error(err, `${c.req.method} ${c.req.path}`);
  return c.json(errorResponse(ERROR_MESSAGES.INTERNAL_ERROR), 500);
};
