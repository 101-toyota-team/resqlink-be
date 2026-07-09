# ResQLink Backend — Developer Guide

> A practical reference for anyone picking up or continuing this project.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Monorepo Layout](#2-monorepo-layout)
3. [Tech Stack](#3-tech-stack)
4. [Local Setup](#4-local-setup)
5. [Environment Variables & Secrets](#5-environment-variables--secrets)
6. [Architecture: How It Fits Together](#6-architecture-how-it-fits-together)
7. [Middleware Pipeline](#7-middleware-pipeline)
8. [Dependency Injection (DI)](#8-dependency-injection-di)
9. [Auth & JWT](#9-auth--jwt)
10. [API Routes](#10-api-routes)
11. [Spatial Indexing (H3)](#11-spatial-indexing-h3)
12. [Real-Time (Supabase Broadcast)](#12-real-time-supabase-broadcast)
13. [Deployment](#13-deployment)
14. [Testing](#14-testing)

---

## 1. Project Overview

ResQLink is an on-demand ambulance dispatch platform. The backend is a **Cloudflare Worker** (TypeScript + Hono) that handles:
- User bookings for ambulances
- Nearby provider/ambulance discovery via H3 spatial indexing
- Real-time driver GPS tracking
- Booking lifecycle management

---

## 2. Monorepo Layout

```
resqlink-be/
├── backend/          ← All real code lives here
│   ├── src/
│   │   ├── index.ts         ← App entry point & middleware wiring
│   │   ├── routes/          ← Route handlers
│   │   ├── services/        ← Business logic
│   │   ├── infrastructure/  ← Supabase, Redis, Mapbox clients
│   │   ├── middleware/      ← Auth, DI, rate-limit, error handler
│   │   ├── schemas/         ← Zod validation schemas
│   │   ├── utils/           ← Helpers, constants, logger
│   │   └── archive/         ← Deprecated simulation code (do not use)
│   ├── test/
│   ├── wrangler.toml
│   └── package.json
├── docs/             ← Integration guides
├── supabase/         ← DB migrations
├── openapi.yaml      ← Full OpenAPI spec
└── Makefile
```

> **Important:** The root `package.json` is a thin wrapper. Run `npm install` inside `backend/`, not the root.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (not Node.js) |
| Framework | [Hono](https://hono.dev) |
| Database | Supabase (PostgreSQL + Auth) |
| Cache / Spatial Index | Upstash Redis (serverless) |
| Maps & Routing | Mapbox Directions & Matrix API |
| Spatial Indexing | Uber H3 (resolution 7) |
| Validation | Zod |
| Language | TypeScript |

> ⚠️ **This is not standard Node.js.** APIs like `process.env` do not exist. Use `c.env` from the Hono context instead.

---

## 4. Local Setup

### Prerequisites

Free-tier accounts needed:
- [Supabase](https://supabase.com) — database & auth
- [Upstash](https://upstash.com) — serverless Redis
- [Mapbox](https://mapbox.com) — routing (needs Directions + Matrix scopes)
- [Cloudflare](https://workers.cloudflare.com) — hosting (for deploy)

### Steps

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Create your local secrets file (see §5)
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your actual credentials

# 3. Start the local dev server
npx wrangler dev
```

The dev server runs at `http://localhost:8787` by default and hot-reloads on file changes.

---

## 5. Environment Variables & Secrets

### Local Development

Create `backend/.dev.vars` (gitignored):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
MAPBOX_ACCESS_TOKEN=pk.your-access-token
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=info
```

Wrangler picks up `.dev.vars` automatically — no extra steps needed.

### Non-Secret Config

Non-sensitive vars (`ALLOWED_ORIGINS`, `LOG_LEVEL`) live in `wrangler.toml` under `[vars]`.

### Production Secrets

Use Wrangler CLI to push secrets to Cloudflare (never commit them):

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
npx wrangler secret put MAPBOX_ACCESS_TOKEN
```

### Where to Find Credentials

| Credential | Where |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_SECRET_KEY` | Supabase Dashboard → Project Settings → API → `service_role` key |
| `UPSTASH_REDIS_REST_URL` | Upstash Dashboard → your Redis DB → REST API section |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Dashboard → your Redis DB → REST API section |
| `MAPBOX_ACCESS_TOKEN` | Mapbox Account → Tokens → create with Directions + Matrix scopes |

---

## 6. Architecture: How It Fits Together

```
User App (mobile)
    │
    ▼
Cloudflare Worker (Hono)
    │
    ├─── Supabase (PostgreSQL)
    │      Bookings, providers, hospitals, drivers, location history
    │
    ├─── Upstash Redis
    │      Driver location cache (hot), H3 spatial index for ambulance discovery
    │
    └─── Mapbox
           Route geometry calculation (ambulance → pickup → destination)

                    ↕ Supabase Realtime Broadcast
        Driver App ──→ POST /driver/location ──→ Worker ──→ channel: trip:{id}
                                                              ↓
                                                        User App subscribes
```

**Data flow summary:**
1. User app calls `GET /providers/nearby?h3_index=...` to find ambulance providers.
2. User creates a booking via `POST /bookings` → status becomes `draft`.
3. Provider assigns an ambulance via `PUT /bookings/:id/assign` → status becomes `confirmed`, route geometry is calculated.
4. Provider sets `en_route` → driver app begins sending GPS via `POST /driver/location`.
5. Worker broadcasts each location update to Supabase Realtime channel `trip:{bookingId}`.
6. User app subscribes to that channel and animates the ambulance on the map.

---

## 7. Middleware Pipeline

Defined in `src/index.ts`. Applied in this order per request:

| # | Middleware | Scope |
|---|---|---|
| 0 | CORS | All routes |
| 0.5 | Request ID (sets `x-request-id` header) | All routes |
| 1 | Env validation (Zod) | All routes |
| 2 | Dependency Injection (`diMiddleware`) | All routes |
| 3 | Rate limiting | `/bookings/*`, `/ambulances/*`, `/driver/*` |
| 3.5 | Request lifecycle logging | All routes |
| 4 | Auth (`supabaseAuth`) | `/bookings`, `/bookings/*`, `/driver/*` |

---

## 8. Dependency Injection (DI)

Services and repositories are **not instantiated globally**. Instead, `diMiddleware` attaches lazy getter functions to the Hono context. They are instantiated on first call and cached for the lifetime of the request.

### How to use in a route handler

```typescript
const bookingService = c.get("getBookingService")();
const cache = c.get("getCache")();
```

### Available getters

| Getter | Returns |
|---|---|
| `c.get("getBookingRepo")()` | `BookingRepository` |
| `c.get("getAmbulanceRepo")()` | `AmbulanceRepository` |
| `c.get("getProviderRepo")()` | `ProviderRepository` |
| `c.get("getHospitalRepo")()` | `HospitalRepository` |
| `c.get("getRealtimeRepo")()` | `RealtimeBroadcaster` |
| `c.get("getDriverLocationRepo")()` | `DriverLocationRepository` |
| `c.get("getDriverRepo")()` | `DriverRepository` |
| `c.get("getMaps")()` | `MapboxRepository` |
| `c.get("getCache")()` | `UpstashRedisRepository` |
| `c.get("getBookingService")()` | `BookingService` |
| `c.get("getDispatchService")()` | `DispatchService` |
| `c.get("getProviderService")()` | `ProviderService` |
| `c.get("getHospitalService")()` | `HospitalService` |
| `c.get("getDistanceService")()` | `DistanceService` |
| `c.get("getDriverService")()` | `DriverService` |
| `c.get("getLogger")()` | `ILogger` |

---

## 9. Auth & JWT

### How It Works

Auth is handled by `src/middleware/auth.ts`. It verifies JWTs against Supabase's JWKS endpoint:

```
GET {SUPABASE_URL}/auth/v1/.well-known/jwks.json
```

**Algorithm enforced: ES256 only.** This is intentional — do not add RS256 or weaken this.

### Protected Routes

- `POST/GET /bookings` and all `/bookings/*` sub-paths
- All `/driver/*` paths

### JWT Payload

After successful auth, the payload is available via `c.get("jwtPayload")`.

```typescript
interface JwtPayload {
  sub: string;            // user_id
  role?: string;          // "provider" | "driver" | "admin" | undefined
  app_metadata: {
    role?: string;        // same as above, for Supabase Auth-linked roles
    provider_id?: string; // present for provider accounts
  };
}
```

### Role Checks

```typescript
import { isDriverRole, isProviderRole, getProviderId } from "../utils/auth";

isDriverRole(payload)    // checks role + app_metadata.role
isProviderRole(payload)  // checks role + app_metadata.role
getProviderId(payload)   // returns app_metadata.provider_id
```

### Unauthenticated Endpoints (no token needed)

- `GET /providers/nearby`
- `GET /providers/search`
- `GET /hospitals/nearby`
- `GET /hospitals/search`
- `GET /ambulances/nearby`

---

## 10. API Routes

For the full OpenAPI spec, see [`openapi.yaml`](../openapi.yaml).
For frontend integration details, see [`FRONTEND_BOOKING_FLOW.md`](./FRONTEND_BOOKING_FLOW.md).

### Quick Reference

| Method | Path | Auth | Description |
|---|---|:---:|---|
| `GET` | `/ambulances/nearby` | ❌ | Find nearby ambulances by H3 index |
| `GET` | `/providers/nearby` | ❌ | Find nearby providers |
| `GET` | `/providers/search` | ❌ | Search providers by name |
| `GET` | `/providers/:id/bookings` | ✅ provider | Get bookings for a provider |
| `GET` | `/hospitals/nearby` | ❌ | Find nearby hospitals |
| `GET` | `/hospitals/search` | ❌ | Search hospitals by name |
| `POST` | `/bookings` | ✅ user | Create a booking |
| `GET` | `/bookings` | ✅ user | List user's bookings |
| `GET` | `/bookings/:id` | ✅ | Get a booking |
| `PUT` | `/bookings/:id/assign` | ✅ provider | Assign ambulance → `confirmed` |
| `PUT` | `/bookings/:id/status` | ✅ | Update booking status |
| `POST` | `/driver/location` | ✅ driver | Send GPS update |
| `GET` | `/driver/assignments` | ✅ driver | Get driver's active bookings |
| `GET` | `/driver/bookings/:id/track` | ✅ | Get driver's latest location |
| `PUT` | `/driver/status` | ✅ driver | Set driver online/offline |

### Booking State Machine

```
draft ──────────────────────────────────────────────── cancelled
  │
  └──(PUT /:id/assign)──→ confirmed ──→ en_route* ──→ arrived ──→ to_hospital ──→ completed
                              │              │             │              │
                           cancelled     cancelled     cancelled      cancelled
```

> `*` `en_route` can only be set by a **provider** or **admin**.

### Rate Limits

- `/bookings/*`, `/ambulances/*`: 30 req/min
- `/driver/*`: 60 req/min

---

## 11. Spatial Indexing (H3)

The project uses [Uber H3](https://h3geo.org/) at **resolution 7** (15-character hex string) for proximity-based discovery.

**How it works:**
- The **mobile app** calculates the H3 index for the user's coordinates and sends it as a query param.
- The **backend** expands the search by computing neighboring H3 cells:
  - **Providers:** progressive `gridRingUnsafe` rings up to radius 30
  - **Hospitals:** `gridDisk(h3Index, 1)` (1-ring expansion)
- Results are queried from Supabase using H3 indices stored in the DB.
- Driver presence (for ambulance discovery) is tracked in **Upstash Redis** with a 300-second TTL.

---

## 12. Real-Time (Supabase Broadcast)

GPS updates are broadcast via Supabase Realtime channels, bypassing the database for high-frequency updates.

### Trip Location Channel

**Channel:** `trip:{bookingId}` | **Event:** `location_update` | **Payload:** `{ lat, lng }`

```javascript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const channel = supabase
  .channel(`trip:${bookingId}`)
  .on("broadcast", { event: "location_update" }, (msg) => {
    const { lat, lng } = msg.payload;
    // animate ambulance marker
  })
  .subscribe();

// Unsubscribe on unmount:
supabase.removeChannel(channel);
```

### Provider New Booking Channel

**Channel:** `provider:{providerId}` | **Event:** `new_booking` | **Payload:** Full `Booking` object

Triggered when a user creates a `draft` booking with a `provider_id`.

### Fallback: Polling

| Status | Recommended interval |
|---|:---:|
| `draft` / `confirmed` | 5–10s |
| `en_route` | 3–5s |
| `arrived` / `to_hospital` | 10s |
| `completed` / `cancelled` | Stop |

---

## 13. Deployment

### Environments

| Environment | Command | Worker name |
|---|---|---|
| Local dev | `npx wrangler dev` | — |
| Staging | `npx wrangler deploy --env staging` | `staging` |
| Production | `npx wrangler deploy --env production` | `api` |

### CI/CD (GitHub Actions)

Set the following in **GitHub → Settings → Secrets and variables → Actions**:

| Type | Name | Description |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Worker deployment |
| Secret | `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth |
| Secret | `SUPABASE_DB_PASSWORD` | DB migration access |
| Secret | `SUPABASE_SECRET_KEY` | Service role key |
| Secret | `UPSTASH_REDIS_REST_TOKEN` | Redis auth |
| Secret | `MAPBOX_ACCESS_TOKEN` | Mapbox token |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| Variable | `SUPABASE_PROJECT_ID` | Supabase project ref |
| Variable | `SUPABASE_URL` | Supabase API URL |
| Variable | `UPSTASH_REDIS_REST_URL` | Redis endpoint |
| Variable | `ALLOWED_ORIGINS` | CORS config |
| Variable | `LOG_LEVEL` | e.g. `info` |

### Database Migrations

Migrations live in `supabase/migrations/` and are applied automatically by CI/CD. To apply locally:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

---

## 14. Testing

```bash
cd backend
npm test             # Run all tests (Vitest)
npm run test:watch   # Watch mode
```

Tests live in `backend/test/`. Infrastructure dependencies (Supabase, Redis, Mapbox) are mocked; tests target the service layer directly.

> The `src/archive/` directory contains deprecated simulation code. It is not tested and should not be used.
