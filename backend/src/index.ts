import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppVariables } from "./types";
import { envSchema, Bindings } from "./schemas/env";
import { Logger } from "./utils/logger";
import { ERROR_MESSAGES, errorResponse } from "./utils/constants";

import { diMiddleware } from "./middleware/di";
import { supabaseAuth } from "./middleware/auth";
import { rateLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";

import discoveryApp from "./routes/discovery";
import bookingsApp from "./routes/bookings";
import driverApp from "./routes/driver";
import hospitalsApp from "./routes/hospitals";
import providersApp from "./routes/providers";

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// 0. CORS Middleware (Must be before Auth and Env Validation to handle preflight)
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = c.env.ALLOWED_ORIGINS || "*";
      if (allowed === "*") return "*";
      const origins = allowed.split(",");
      return origins.includes(origin) ? origin : null;
    },
  }),
);

// 0.5. Request Correlation Middleware
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  await next();
  c.res.headers.set("x-request-id", requestId);
});

// 1. Environment Validation Middleware
app.use("*", async (c, next) => {
  const result = envSchema.safeParse(c.env);
  if (!result.success) {
    const bootstrapLogger = new Logger(c.env.LOG_LEVEL);
    bootstrapLogger.error("Invalid environment variables");
    return c.json(errorResponse(ERROR_MESSAGES.CONFIGURATION_ERROR), 500);
  }
  await next();
});

// 2. Dependency Injection Middleware
app.use("*", diMiddleware);

// 3. Rate Limiting Middleware (after DI, before auth)
app.use("/ambulances/*", rateLimiter("RL_DEFAULT"));
app.use("/bookings/*", rateLimiter("RL_DEFAULT"));
app.use("/bookings", rateLimiter("RL_DEFAULT"));
app.use("/driver/*", rateLimiter("RL_DRIVER"));

// 3.5. Request Lifecycle Logging
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const durationMs = Math.round(performance.now() - start);
  const logger = new Logger(c.env.LOG_LEVEL, {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    statusCode: c.res.status,
    durationMs,
  });
  logger.info("Request completed");
});

// 4. Auth Middleware
app.use("/bookings", supabaseAuth);
app.use("/bookings/*", supabaseAuth);
app.use("/driver/*", supabaseAuth);

app.get("/", (c) => c.text("ResQLink Robust API - Status: Online"));

app.route("/ambulances", discoveryApp);
app.route("/bookings", bookingsApp);
app.route("/driver", driverApp);
app.route("/hospitals", hospitalsApp);
app.route("/providers", providersApp);

app.onError(errorHandler);

export default app;
