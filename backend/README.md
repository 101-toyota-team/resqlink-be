# Vehicle Routing App Backend

This is the Cloudflare Workers backend for the vehicle routing app.

## Tech Stack
- **Language**: TypeScript
- **Framework**: Cloudflare Workers
- **Database**: Supabase (PostgreSQL for durable data)
- **Real-time State**: Upstash Serverless Redis (H3 Spatial Indexing)

## Local Setup

1. Install Node.js (v18+) and npm.
2. Create a development project at [supabase.com](https://supabase.com).
3. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
4. Configure `.dev.vars` with your Cloud Supabase credentials and an Upstash Redis URL.
5. Start the local Wrangler development server:
   ```bash
   npx wrangler dev
   ```

## 🛠 Backend logic notes
*   **H3 Neighbor Expansion**: The backend is responsible for expanding the search radius using `h3.gridDisk(h3Index, 1)`. 
*   **Matchmaking**: Discovery queries Upstash Redis sets (`h3_zone:{index}`) in parallel to find available drivers.
*   **Presence**: Driver location keys in Redis have a 15-second TTL. The backend considers a driver "Phantom/Offline" if no ping is received for 60 seconds (monitored via Supabase status).

