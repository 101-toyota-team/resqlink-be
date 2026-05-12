import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("Integration Tests", () => {
  it("should return 200 on root endpoint", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
  });

  it("should return 404 on unknown route", async () => {
    const res = await app.request("/unknown-route", {}, env);
    expect(res.status).toBe(404);
  });
});
