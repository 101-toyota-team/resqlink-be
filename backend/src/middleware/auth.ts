import { Context, Next } from "hono";
import { verifyWithJwks } from "hono/jwt";
import { JwtPayload } from "../types";
import { Bindings } from "../schemas/env";

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
    c.set("jwtPayload", payload as JwtPayload);
    await next();
  } catch (e: unknown) {
    const error = e as Error;
    if (
      error.message?.includes("fetch") ||
      error.message?.includes("JWKS") ||
      error.message?.includes("network")
    ) {
      console.error("Auth infrastructure error:", error);
      return c.json({ error: "Authentication service unavailable" }, 500);
    }
    return c.json({ error: "Invalid token" }, 401);
  }
};
