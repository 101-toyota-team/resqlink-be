import { Context, Next } from "hono";
import { verifyWithJwks } from "hono/jwt";
import { AppVariables, JwtPayload } from "../types";
import { Bindings } from "../schemas/env";
import { ERROR_MESSAGES, errorResponse } from "../utils/constants";

// Type guard to validate JWT payload structure
function isValidJwtPayload(payload: unknown): payload is JwtPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).sub === "string"
  );
}

export const supabaseAuth = async (
  c: Context<{ Bindings: Bindings; Variables: AppVariables }>,
  next: Next,
) => {
  const logger = c.get("getLogger")();
  const authHeader = c.req.header("Authorization");
  if (!authHeader)
    return c.json(errorResponse(ERROR_MESSAGES.UNAUTHORIZED), 401);

  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = await verifyWithJwks(token, {
      jwks_uri: `${c.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      allowedAlgorithms: ["RS256"],
      verification: {
        iss: `${c.env.SUPABASE_URL}/auth/v1`,
      },
    });

    if (!isValidJwtPayload(payload)) {
      logger.error("Invalid JWT payload structure", { payload });
      return c.json(errorResponse(ERROR_MESSAGES.INVALID_TOKEN), 401);
    }

    c.set("jwtPayload", payload);
    await next();
  } catch (error) {
    logger.error("JWT verification failed", { error });
    return c.json(errorResponse(ERROR_MESSAGES.INVALID_TOKEN), 401);
  }
};
