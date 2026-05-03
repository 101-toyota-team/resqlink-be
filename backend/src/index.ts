import { Hono } from "hono";
import { SupabaseRepository } from "./infrastructure/supabase";
import { DispatchService } from "./services/dispatch";
import { JwtPayload } from "./types";
import { envSchema, Bindings } from "./schemas/env";

import { diMiddleware } from "./middleware/di";
import { supabaseAuth } from "./middleware/auth";

import discoveryApp from "./routes/discovery";
import bookingsApp from "./routes/bookings";
import driverApp from "./routes/driver";
import hospitalsApp from "./routes/hospitals";

type Variables = {
  getDispatchService: () => DispatchService;
  getDb: () => SupabaseRepository;
  jwtPayload: JwtPayload;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 0. Environment Validation Middleware
app.use("*", async (c, next) => {
  const result = envSchema.safeParse(c.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    return c.json(
      { error: "Configuration error", details: result.error.format() },
      500,
    );
  }
  await next();
});

// 1. Dependency Injection Middleware
app.use("*", diMiddleware);

app.use("/bookings", supabaseAuth);
app.use("/bookings/*", supabaseAuth);
app.use("/driver/*", supabaseAuth);

app.get("/", (c) => c.text("ResQLink Robust API - Status: Online"));

app.route("/ambulances", discoveryApp);
app.route("/bookings", bookingsApp);
app.route("/driver", driverApp);
app.route("/hospitals", hospitalsApp);

export default app;
