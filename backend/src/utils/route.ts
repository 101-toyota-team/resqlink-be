import { Hono } from "hono";
import { Bindings } from "../schemas/env";
import { AppVariables } from "../types";

type AppEnv = { Bindings: Bindings; Variables: AppVariables };

export function createRouteApp() {
  return new Hono<AppEnv>();
}
