# ResQLink: On-Demand Ambulance Dispatch (Backend)

ResQLink is a high-performance, edge-optimized ambulance booking and tracking platform. It utilizes a **Modern Edge Architecture** to minimize server costs while providing sub-50ms latency for real-time tracking.

## 🏗 Architecture Overview
This project consists of:
*   **Backend**: Cloudflare Workers (TypeScript) powered by Hono.
*   **Database**: Supabase (PostgreSQL) for persistence and Auth.
*   **Real-time State**: Upstash Serverless Redis for O(1) H3 spatial matchmaking.
*   **Spatial Indexing**: Uber H3 (Resolution 7) calculated client-side (by the mobile app).
*   **Maps**: Mapbox API.

## 📚 Documentation

| Guide | Description |
|---|---|
| [`docs/BACKEND_GUIDE.md`](docs/BACKEND_GUIDE.md) | Full developer onboarding: setup, middleware, DI, auth, routes, deployment |
| [`docs/FRONTEND_BOOKING_FLOW.md`](docs/FRONTEND_BOOKING_FLOW.md) | Frontend integration guide: API reference, booking flow, Realtime, TypeScript types |
| [`openapi.yaml`](openapi.yaml) | Full OpenAPI spec |

## 🚀 Getting Started

### 1. Prerequisites
You will need free-tier accounts and API keys for:
*   [Supabase](https://supabase.com) (Database & Auth)
*   [Mapbox](https://www.mapbox.com/) (Maps & Routing)
*   [Upstash](https://upstash.com) (Serverless Redis)
*   [Cloudflare](https://workers.cloudflare.com) (Backend hosting)

### 2. Environment Setup
Create the following secret file (it is gitignored):

**Backend (`backend/.dev.vars`):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
MAPBOX_ACCESS_TOKEN=pk.your-access-token
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=info
```

### 3. Running Locally
1.  Ensure your Supabase Cloud project is active.
2.  Start the backend worker:
    *   `cd backend && npx wrangler dev`

## 🛠 Project Standards
*   **H3 Resolution**: Level **7** is the project standard (15-character hex).
*   **Matchmaking**: Static discovery (Providers/Hospitals) queries Supabase. The Backend is responsible for `gridDisk(1)` neighbor expansion (hospitals) and multi-ring progressive search via `gridRingUnsafe` up to radius 30 (providers). Real-time simulation state and driver presence pings are managed in Upstash Redis.
*   **Real-time**: High-frequency GPS updates use Supabase Broadcast Channels (bypassing DB disk).
*   **Mapbox Access Tokens**: Ensure you have created a token for the backend (Cloudflare Worker). Ensure the token has scopes for Directions and Matrix APIs.

## 📦 Deployment

### GitHub Actions Configuration
The following environment variables must be configured in your GitHub Repository settings (**Settings > Secrets and variables > Actions**):

| Type | Name | Description |
| :--- | :--- | :--- |
| **Secrets** | `SUPABASE_ACCESS_TOKEN` | Administrative CLI access. |
| **Secrets** | `SUPABASE_DB_PASSWORD` | Direct DB access. |
| **Secrets** | `CLOUDFLARE_API_TOKEN` | Worker deployment permission. |
| **Secrets** | `UPSTASH_REDIS_REST_TOKEN` | Redis authentication. |
| **Secrets** | `SUPABASE_SECRET_KEY` | `service_role` key (bypasses RLS). |
| **Secrets** | `MAPBOX_ACCESS_TOKEN` | Mapbox token (masked in logs). |
| **Variables** | `SUPABASE_PROJECT_ID` | Public project reference. |
| **Variables** | `CLOUDFLARE_ACCOUNT_ID` | Public account identifier. |
| **Variables** | `SUPABASE_URL` | Public API gateway URL. |
| **Variables** | `UPSTASH_REDIS_REST_URL` | Public Redis endpoint. |
| **Variables** | `ALLOWED_ORIGINS` | CORS configuration. |
| **Variables** | `LOG_LEVEL` | Logging verbosity (default: `info`). |

To push database migrations to Supabase and deploy the Cloudflare Worker simultaneously:
*   `cd backend && npx wrangler deploy`

### Troubleshooting CI/CD Failures
If the "Deploy Supabase Migrations" step fails with a password authentication error:
1.  **Verify your password**: Ensure `SUPABASE_DB_PASSWORD` in GitHub Secrets matches your database password.
2.  **Test locally**: Run the following command to verify your password works:
    ```bash
    supabase link --project-ref your-project-ref --password your-password
    ```
3.  **Reset password**: If you've forgotten it, reset it in the Supabase Dashboard under **Project Settings > Database**.

---

## 🔑 Detailed Credential Setup Guide

### 1. Supabase (Database, Auth, & Realtime)
We use Supabase's modern asymmetric keys and JWKS. You do **not** need to store a JWT signing secret manually.

**Steps:**
1. Go to [Supabase](https://supabase.com/) and create or open your project.
2. Navigate to **Project Settings** (the gear icon on the bottom left).
3. Go to **API** under the Configuration section.
4. **Gather your credentials:**
   *   **Project URL:** Found under "Project URL" (`https://[reference-id].supabase.co`).
       *   *Used in:* Backend (`SUPABASE_URL`)
   *   **Publishable Key (`anon` / `public`):** Found under "Project API Keys". This will be needed by the separate Frontend repo.
   *   **Secret Key (`service_role` / `secret`):** Found right below the anon key. Keep this highly secure! This bypasses RLS.
       *   *Used in:* Backend (`SUPABASE_SECRET_KEY`)

### 2. Mapbox Platform
The project requires a Mapbox Access Token for the backend (and the separate frontend repo).

**Steps:**
1. Go to the [Mapbox Account page](https://account.mapbox.com/).
2. Create a new token.
3. Ensure the token has access to the **Directions** and **Matrix** APIs.
4. Copy the generated token.
   *   *Used in:* Backend (`MAPBOX_ACCESS_TOKEN`)

### 3. Upstash (Serverless Redis)
Upstash is used by the backend for high-speed spatial indexing (H3) and matchmaking.

**Steps:**
1. Go to [Upstash](https://upstash.com/) and navigate to the **Redis** tab.
2. Click **"Create Database"**, name it, and select a region close to your Supabase/Cloudflare instances.
3. Once created, scroll down to the **"REST API"** section on the database dashboard.
4. **Gather your credentials:**
   *   Copy the **UPSTASH_REDIS_REST_URL**
       *   *Used in:* Backend (`UPSTASH_REDIS_REST_URL`)
   *   Copy the **UPSTASH_REDIS_REST_TOKEN**
       *   *Used in:* Backend (`UPSTASH_REDIS_REST_TOKEN`)

### 4. Cloudflare (Workers API Backend)
Wrangler handles authentication via the CLI, but you need the deployed URL for any client to connect to.

**Steps:**
1. Authenticate your local development environment by running `npx wrangler login` in your terminal.
2. Once you deploy your backend using `npx wrangler deploy` inside the `backend/` directory, Cloudflare will output the live URL of your worker (e.g., `https://backend.your-subdomain.workers.dev`).
3. **Gather your credential:**
   *   *Used in:* Frontend repo (`WORKER_API_URL`)
## Deployment Test
