import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("CORS Middleware", () => {
  const ALLOWED_ORIGINS = "http://localhost:3000,https://resqlink.app";
  const MOCK_ENV = {
    ALLOWED_ORIGINS,
    UPSTASH_REDIS_REST_URL: "https://mock-redis.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "mock-token",
    SUPABASE_URL: "https://mock-supabase.supabase.co",
    SUPABASE_SECRET_KEY: "mock-key",
    MAPBOX_ACCESS_TOKEN: "mock-mapbox-token",
  };

  it("should allow preflight requests from allowed origins", async () => {
    const res = await app.request(
      "/",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Content-Type",
        },
      },
      MOCK_ENV,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "Content-Type",
    );
  });

  it("should allow preflight requests from another allowed origin", async () => {
    const res = await app.request(
      "/",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://resqlink.app",
          "Access-Control-Request-Method": "POST",
        },
      },
      MOCK_ENV,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://resqlink.app",
    );
  });

  it("should NOT return CORS headers for blocked origins", async () => {
    const res = await app.request(
      "/",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://malicious.com",
          "Access-Control-Request-Method": "GET",
        },
      },
      MOCK_ENV,
    );

    // Hono's CORS middleware returns 204 for preflight even if origin is not allowed,
    // but it should NOT include the Access-Control-Allow-Origin header.
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("should allow all origins if ALLOWED_ORIGINS is set to *", async () => {
    const res = await app.request(
      "/",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://any-origin.com",
          "Access-Control-Request-Method": "GET",
        },
      },
      { ...MOCK_ENV, ALLOWED_ORIGINS: "*" },
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("should include CORS headers on actual requests from allowed origins", async () => {
    const res = await app.request(
      "/",
      {
        method: "GET",
        headers: {
          Origin: "http://localhost:3000",
        },
      },
      MOCK_ENV,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
  });
});
