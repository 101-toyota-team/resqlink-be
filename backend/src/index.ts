import { Hono } from "hono";
import { AppVariables } from "./types";
import { envSchema, Bindings } from "./schemas/env";
import logger from "./utils/logger";

import { diMiddleware } from "./middleware/di";
import { supabaseAuth } from "./middleware/auth";

import discoveryApp from "./routes/discovery";
import bookingsApp from "./routes/bookings";
import driverApp from "./routes/driver";
import hospitalsApp from "./routes/hospitals";

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// 0. Environment Validation Middleware
app.use("*", async (c, next) => {
  const result = envSchema.safeParse(c.env);
  if (!result.success) {
    logger.error("Invalid environment variables: %O", result.error.format());
    return c.json(
      { error: "Configuration error", details: result.error.format() },
      500,
    );
  }
  await next();
});

// 1. Dependency Injection Middleware
app.use("*", diMiddleware);

// 2. Auth Middleware
app.use("/bookings", supabaseAuth);
app.use("/bookings/*", supabaseAuth);
app.use("/driver/*", supabaseAuth);

app.get("/", (c) => c.text("ResQLink Robust API - Status: Online"));

app.route("/ambulances", discoveryApp);
app.route("/bookings", bookingsApp);
app.route("/driver", driverApp);
app.route("/hospitals", hospitalsApp);

app.onError((err, c) => {
  logger.error("Unhandled exception: %s", err.message, { stack: err.stack });
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500,
  );
});

export default app;
