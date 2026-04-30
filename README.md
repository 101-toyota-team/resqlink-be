# ResQLink: On-Demand Ambulance Dispatch (Backend)

ResQLink is a high-performance, edge-optimized ambulance booking and tracking platform. It utilizes a **Modern Edge Architecture** to minimize server costs while providing sub-50ms latency for real-time tracking.

## 🏗 Architecture Overview
This project consists of:
*   **Backend**: Cloudflare Workers (TypeScript) powered by Hono.
*   **Database**: Supabase (PostgreSQL) for persistence and Auth.
*   **Real-time State**: Upstash Serverless Redis for O(1) H3 spatial matchmaking.
*   **Spatial Indexing**: Uber H3 (Resolution 8) calculated client-side (by the mobile app).
*   **Maps**: Google Maps Platform API.

## 🚀 Getting Started

### 1. Prerequisites
You will need free-tier accounts and API keys for:
*   [Supabase](https://supabase.com) (Database & Auth)
*   [Google Maps Platform](https://mapsplatform.google.com/) (Maps & Routing)
*   [Upstash](https://upstash.com) (Serverless Redis)
*   [Cloudflare](https://workers.cloudflare.com) (Backend hosting)

### 2. Environment Setup
Create the following secret file (it is gitignored):

**Backend (`backend/.dev.vars`):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
GOOGLE_MAPS_API_KEY=your-google-maps-key
```

### 3. Running Locally
1.  Ensure your Supabase Cloud project is active.
2.  Start the backend worker:
    *   `cd backend && npx wrangler dev`

## 🛠 Project Standards
*   **H3 Resolution**: Level **8** is the project standard.
*   **Matchmaking**: The Backend is responsible for `kRing(1)` neighbor expansion.
*   **Real-time**: High-frequency GPS updates use Supabase Broadcast Channels (bypassing DB disk).
*   **Google Maps API Keys**: Ensure you have created a restricted key for the backend (Cloudflare Worker). No special scopes are needed for Matrix, Directions, or Places APIs beyond enabling them in the Google Cloud Console.

## 📦 Deployment
To push database migrations to Supabase and deploy the Cloudflare Worker simultaneously:
*   `cd backend && npx wrangler deploy`

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

### 2. Google Maps Platform
The project requires a Google Maps API Key for the backend (and the separate frontend repo). Google provides a recurring $200 monthly credit.

**Steps:**
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named "ResQLink".
3. Enable the following APIs:
   * Distance Matrix API
   * Directions API
   * Places API
   * (And Maps SDK for Android/iOS if setting up for the frontend)
4. Go to **Credentials**, click **Create Credentials** -> **API Key**.
5. **Security Step:** Create a restricted key for the backend.
6. Copy the generated key.
   *   *Used in:* Backend (`GOOGLE_MAPS_API_KEY`)

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
