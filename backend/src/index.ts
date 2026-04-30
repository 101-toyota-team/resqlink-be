import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { UpstashRedisRepository } from './infrastructure/upstash';
import { SupabaseRepository } from './infrastructure/supabase';
import { GoogleMapsRepository } from './infrastructure/google-maps';
import { DispatchService } from './services/dispatch';

type Bindings = {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  GOOGLE_MAPS_API_KEY: string;
};

type Variables = {
  dispatchService: DispatchService;
  db: SupabaseRepository;
  user: any; // Added by JWT middleware
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 1. Dependency Injection Middleware (Always runs)
app.use('*', async (c, next) => {
  const cacheRepo = new UpstashRedisRepository(
    c.env.UPSTASH_REDIS_REST_URL,
    c.env.UPSTASH_REDIS_REST_TOKEN
  );
  
  const dbRepo = new SupabaseRepository(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SECRET_KEY
  );

  const mapsRepo = new GoogleMapsRepository(c.env.GOOGLE_MAPS_API_KEY);

  c.set('dispatchService', new DispatchService(cacheRepo, mapsRepo));
  c.set('db', dbRepo);
  
  await next();
});

// 2. Auth Middleware (Protects sensitive routes)
app.use('/bookings/*', (c, next) => {
  const auth = jwt({
    jwks_uri: `${c.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  });
  return auth(c, next);
});

app.use('/driver/*', (c, next) => {
  // Drivers also need to be authenticated
  const auth = jwt({
    jwks_uri: `${c.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  });
  return auth(c, next);
});

app.get('/', (c) => c.text('ResQLink Robust API - Status: Online'));

// 5.1 Ambulance Discovery (Public)
app.get('/ambulances/nearby', async (c) => {
  const h3Index = c.req.query('h3_index');
  const pickup = c.req.query('pickup'); // Optional: "lat,lng"
  
  if (!h3Index) return c.json({ error: 'h3_index is required' }, 400);

  const dispatchService = c.get('dispatchService');
  const drivers = await dispatchService.findNearbyDrivers(h3Index, 1, pickup);

  return c.json({ 
    center: h3Index,
    found_drivers: drivers 
  });
});

// 5.2 Booking (Protected)
app.post('/bookings', async (c) => {
  const body = await c.req.json();
  const db = c.get('db');
  const payload = c.get('jwtPayload'); // Hono puts the decoded JWT here
  
  // Enforce user_id from token
  const bookingData = { ...body, user_id: payload.sub };
  
  const booking = await db.createBooking(bookingData);
  return c.json(booking, 201);
});

// Driver telemetry ping (Protected)
app.post('/driver/ping', async (c) => {
  const body = await c.req.json();
  const { driver_id, h3_index } = body;
  
  // Verify that the JWT belongs to this driver_id
  const payload = c.get('jwtPayload');
  if (payload.sub !== driver_id) {
    return c.json({ error: 'Unauthorized driver' }, 403);
  }
  
  const dispatchService = c.get('dispatchService');
  await dispatchService.updateDriverStatus(driver_id, body, h3_index);
  
  return c.json({ status: 'ok' });
});

// 5.3 Hospital Search
app.get('/hospitals/search', async (c) => {
  const query = c.req.query('query');
  if (!query) return c.json({ error: 'query is required' }, 400);

  // We need access to mapsRepo here. 
  // Since we already set up DispatchService, maybe we should add it to Variables or inject into a SearchService.
  // For brevity in this MVP, I'll instantiate it or use the one from a service if available.
  const mapsRepo = new GoogleMapsRepository(c.env.GOOGLE_MAPS_API_KEY);
  const results = await mapsRepo.searchPlaces(query);

  return c.json(results);
});

export default app;
