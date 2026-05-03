import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("ResQLink API", () => {
  it("should return 200 and the status message on GET /", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ResQLink Robust API - Status: Online");
  });
});
