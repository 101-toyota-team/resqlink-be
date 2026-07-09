# ResQLink: On-Demand Ambulance Dispatch (Backend)

This is the Cloudflare Workers backend for the ResQLink platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | [Hono](https://hono.dev) |
| Database | Supabase (PostgreSQL + Auth) |
| Real-time | Supabase Realtime Broadcast |
| Cache / Spatial Index | Upstash Serverless Redis |
| Maps & Routing | Mapbox Directions & Matrix API |
| Spatial Indexing | Uber H3 (Resolution 7) |
| Language | TypeScript |

> ⚠️ **Not standard Node.js.** Use `c.env` (Hono context) for environment variables — `process.env` does not exist in Cloudflare Workers.

## Local Setup

1. Install Node.js (v18+) and npm.
2. Create accounts at [supabase.com](https://supabase.com), [upstash.com](https://upstash.com), and [mapbox.com](https://mapbox.com).
3. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
4. Copy the example secrets file and fill in your credentials:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   Required: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `MAPBOX_ACCESS_TOKEN`, `ALLOWED_ORIGINS`.
5. Start the local dev server (picks up `.dev.vars` automatically):
   ```bash
   npx wrangler dev
   ```

## Key Architecture Notes

- **Middleware order**: CORS → Request ID → Env validation → DI → Rate limiting → Logging → Auth. See `src/index.ts`.
- **Dependency Injection**: Services and repos are lazy-initialized per-request via `diMiddleware`. Access them in handlers with `c.get("getBookingService")()`, etc.
- **Auth**: JWT verified against Supabase JWKS (ES256 only). Applied to `/bookings/*` and `/driver/*`.
- **H3 Spatial Search**: Backend expands H3 rings via `gridDisk` (hospitals) and `gridRingUnsafe` up to radius 30 (providers). Resolution **7** (15-char hex) is the enforced standard.
- **Driver Presence**: Location keys in Redis have a 300-second TTL.
- **`src/archive/`**: Contains deprecated simulation code — do not use.

For the full developer guide, see [`docs/BACKEND_GUIDE.md`](../docs/BACKEND_GUIDE.md).
