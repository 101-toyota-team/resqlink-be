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
4. Configure `.dev.vars` with your **dev** environment credentials, including `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `MAPBOX_ACCESS_TOKEN`.
5. Start the local Wrangler development server (it will automatically pick up `.dev.vars`):
   ```bash
   npx wrangler dev
   ```

## 🛠 Backend logic notes
*   **H3 Neighbor Expansion**: The backend is responsible for expanding the search radius using `h3.gridDisk(h3Index, 1)` (hospitals) and progressive `gridRingUnsafe` up to radius 30 (providers). Resolution **7** (15-character hex) is the enforced standard.
*   **Matchmaking**: Discovery queries **Supabase** (using H3 indices) to find available providers and hospitals.
*   **Presence**: Ambulance location keys in Redis have a 300-second (5-minute) TTL. The backend prunes stale ambulances from sorted sets after 60 seconds of inactivity (`zremrangebyscore`).
*   **Simulation**: Active trip state is stored in Redis (`sim:route`, `sim:step`) with a 1-hour TTL.

