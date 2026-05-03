import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { beforeAll, afterAll, afterEach } from "vitest";

export const handlers = [
  // Example: Mock Upstash Redis REST calls
  http.post("https://*.upstash.io/*", () => {
    return HttpResponse.json({ result: "OK" });
  }),

  // Example: Mock Google Maps API
  http.get("https://maps.googleapis.com/maps/api/distancematrix/json", () => {
    return HttpResponse.json({
      rows: [
        {
          elements: [
            {
              duration: { text: "10 mins" },
              distance: { text: "2.5 km" },
              status: "OK",
            },
          ],
        },
      ],
      status: "OK",
    });
  }),

  // Mock Supabase JWKS
  http.get("https://*.supabase.co/auth/v1/.well-known/jwks.json", () => {
    return HttpResponse.json({
      keys: [
        {
          alg: "RS256",
          kty: "RSA",
          use: "sig",
          n: "test-n",
          e: "AQAB",
          kid: "test-kid",
          x5c: ["test-x5c"],
          x5t: "test-x5t",
        },
      ],
    });
  }),
];

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
