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
          alg: "ES256",
          kty: "EC",
          crv: "P-256",
          use: "sig",
          kid: "test-kid-es256",
          x: "MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4",
          y: "4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM",
        },
      ],
    });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
