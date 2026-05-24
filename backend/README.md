# Vehicle Routing App Backend

This is the Cloudflare Workers backend for the vehicle routing app.

## Tech Stack
- **Language**: TypeScript
- **Framework**: Cloudflare Workers
- **Database**: Supabase (PostgreSQL for durable data)
- **Real-time State**: Upstash Serverless Redis (Simulation state & Rate limiting)
- **Spatial Indexing**: Uber H3 (Resolution 7) for proximity searches.

## Local Setup

1. Install Node.js (v18+) and npm.
2. Create a development project at [supabase.com](https://supabase.com).
3. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
4. Configure `.dev.vars` with your `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `GOOGLE_MAPS_API_KEY`.
5. Start the local Wrangler development server:
   ```bash
   npx wrangler dev
   ```

## 🛠 Backend logic notes
*   **H3 Neighbor Expansion**: The backend is responsible for expanding the search radius using `h3.gridDisk(h3Index, 1)`. Resolution **7** (15-character hex) is the enforced standard.
*   **Matchmaking**: Discovery queries **Supabase** (using H3 indices) to find available providers and hospitals.
*   **Presence**: Driver location keys in Redis have a 15-second TTL. The backend considers a driver "Phantom/Offline" if no ping is received for 60 seconds (monitored via Supabase status).
*   **Simulation**: Active trip state is stored in Redis (`sim:route`, `sim:step`) with a 1-hour TTL.

