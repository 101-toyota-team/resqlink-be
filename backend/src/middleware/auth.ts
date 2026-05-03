import { Context, Next } from "hono";
import { verifyWithJwks } from "hono/jwt";
import { JwtPayload } from "../types";
import { Bindings } from "../schemas/env";
import logger from "../utils/logger";

// Type guard to validate JWT payload structure
function isValidJwtPayload(payload: unknown): payload is JwtPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).sub === "string"
  );
}

// Type guard for error handling
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export const supabaseAuth = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JwtPayload } }>,
  next: Next,
) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);

  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = await verifyWithJwks(token, {
      jwks_uri: `${c.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      allowedAlgorithms: ["RS256"],
    });
    
    if (!isValidJwtPayload(payload)) {
      logger.error("Invalid JWT payload structure: %O", payload);
      return c.json({ error: "Invalid token" }, 401);
    }
    
    c.set("jwtPayload", payload);
    await next();
  } catch (e: unknown) {
    if (isError(e)) {
      if (
        e.message?.includes("fetch") ||
        e.message?.includes("JWKS") ||
        e.message?.includes("network")
      ) {
        logger.error("Auth infrastructure error: %O", e);
        return c.json({ error: "Authentication service unavailable" }, 500);
      }
    }
    return c.json({ error: "Invalid token" }, 401);
  }
};
