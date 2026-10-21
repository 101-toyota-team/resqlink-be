# ResQLink Architecture — C4 Views

ResQLink is an on-demand ambulance dispatch backend: one Cloudflare Worker (Hono, TypeScript) that serves the user, provider and driver apps and talks to Supabase, Upstash Redis, Mapbox, and Supabase Realtime.

---

## C4 Level 1 — System Context

```mermaid
C4Context
    title System Context diagram for ResQLink
    Person(user, "User", "Mobile app: books & tracks")
    Person(provider, "Provider", "Demo app: assigns & manages")
    Person(driver, "Driver", "Mobile app: GPS + status")
    System(resqlink, "ResQLink API", "Cloudflare Worker (Hono)")
    System_Ext(supabase, "Supabase", "PostgreSQL + Auth")
    System_Ext(redis, "Upstash Redis", "Presence + caches")
    System_Ext(mapbox, "Mapbox", "Directions + Matrix")
    System_Ext(realtime, "Supabase Realtime", "Broadcast channels")
    Rel(user, resqlink, "Books & tracks")
    Rel(provider, resqlink, "Assigns & updates")
    Rel(driver, resqlink, "Sends GPS")
    Rel(resqlink, supabase, "SQL + JWKS")
    Rel(resqlink, redis, "Cache get/set")
    Rel(resqlink, mapbox, "Routing")
    Rel(resqlink, realtime, "Broadcasts")
```

This shows the actors, the single deployable system, and its four external services; the driver's GPS updates enter at the Worker and reach the user app as Realtime broadcasts on `trip:{bookingId}`, which the apps subscribe to directly.

---

## C4 Level 2 — Container

```mermaid
C4Container
    title Container diagram for ResQLink
    Person(user, "User", "Mobile app: books & tracks")
    Person(provider, "Provider", "Demo app: assigns & manages")
    Person(driver, "Driver", "Mobile app: GPS + status")
    Container(api, "ResQLink API", "Cloudflare Worker, Hono", "All HTTP routes")
    SystemDb(supabase, "Supabase", "PostgreSQL + Auth")
    SystemDb(redis, "Upstash Redis", "Presence + caches")
    System_Ext(mapbox, "Mapbox", "Directions + Matrix")
    System_Ext(realtime, "Supabase Realtime", "Broadcast channels")
    Rel(user, api, "Books & tracks")
    Rel(provider, api, "Assigns & updates")
    Rel(driver, api, "Sends GPS")
    Rel(api, supabase, "SQL + JWKS")
    Rel(api, redis, "Cache get/set")
    Rel(api, mapbox, "Routing")
    Rel(api, realtime, "Broadcasts")
```

This shows the internals of the system: a single Worker container handling all HTTP traffic, with the middleware wired in `backend/src/index.ts` and no other deployable unit.

---

## C4 Level 3 — Component

Opening up the Worker: the middleware chain runs in the order registered on the Hono app in `backend/src/index.ts`, then each mounted sub-app resolves its services through the DI getters and reaches the database only through a repository interface.

```mermaid
C4Component
    title Component diagram — ResQLink Cloudflare Worker

    Container_Boundary(worker, "Cloudflare Worker", "Hono + TypeScript") {
        Container_Boundary(middleware, "Middleware chain (src/index.ts order)") {
            Component(cors, "1 · CORS", "hono/cors", "ALLOWED_ORIGINS allowlist")
            Component(requestId, "2 · Request ID", "inline middleware", "x-request-id header")
            Component(envCheck, "3 · Env validation", "Zod envSchema", "500 CONFIGURATION_ERROR")
            Component(di, "4 · DI", "middleware/di.ts", "lazy getters per request")
            Component(rateLimit, "5 · Rate limiting", "RL_DEFAULT / RL_DRIVER", "keyed by client IP, 429")
            Component(logging, "6 · Logging", "utils/logger.ts", "method, path, status, duration")
            Component(auth, "7 · supabaseAuth", "verifyWithJwks", "ES256 only, /bookings + /driver")
            Component(errorHandler, "8 · Error handler", "app.onError", "404 / 403 / 400 / 500 JSON")
        }
        Component(router, "Hono router", "app.route()", "mounts five sub-apps")
        Container_Boundary(routes, "Routes — HTTP handlers + Zod") {
            Component(bookingRoutes, "Booking routes", "routes/bookings.ts", "CRUD, assign, status")
            Component(driverRoutes, "Driver routes", "routes/driver.ts", "location, assignments, track, status")
            Component(readRoutes, "Discovery, provider and hospital routes", "routes/discovery.ts, providers.ts, hospitals.ts", "nearby, search")
        }
        Container_Boundary(services, "Services — business logic") {
            Component(bookingService, "BookingService", "services/bookings.ts", "draft, assign, VALID_TRANSITIONS")
            Component(dispatchService, "DispatchService", "services/dispatch.ts", "H3 ambulance search")
            Component(providerService, "ProviderService", "services/providers.ts", "search, nearby")
            Component(hospitalService, "HospitalService", "services/hospitals.ts", "search, nearby")
            Component(distanceService, "DistanceService", "services/distance.ts", "route legs, Redis cache")
            Component(driverService, "DriverService", "services/driver.ts", "GPS, assignments, availability")
        }
        Container_Boundary(repositories, "Repositories — interfaces only") {
            Component(bookingRepoIface, "Booking and ambulance interfaces", "IBookingRepository, IAmbulanceRepository", "create, assign, availability")
            Component(discoveryIface, "Discovery interfaces", "IProviderRepository, IHospitalRepository", "search, H3 lookup")
            Component(realtimeIface, "IRealtimeBroadcaster", "repositories/realtime.ts", "new booking, assigned, status, location")
            Component(mapsCacheIface, "Maps and cache interfaces", "IMapsRepository, IGenericCache", "directions, matrix, get and set")
            Component(driverIface, "Driver interfaces", "IDriverRepository, IDriverLocationRepository", "availability, latest GPS")
        }
        Container_Boundary(infrastructure, "Infrastructure — implementations") {
            Component(supabaseRepos, "Supabase repositories", "supabase/booking, ambulance, provider, hospital", "SupabaseClientBase plus Zod parsing")
            Component(realtimeRepo, "RealtimeBroadcaster", "supabase/realtime.ts", "REST channel.send")
            Component(redisRepo, "UpstashRedisRepository", "upstash.ts", "Redis REST client")
            Component(mapboxRepo, "MapboxRepository", "mapbox.ts", "Directions, Matrix")
            Component(driverRepos, "Driver repositories", "driver-repo.ts, driver-location.ts", "drivers table, cache plus inserts")
        }
    }

    Container_Boundary(external, "External systems") {
        ComponentDb_Ext(postgres, "Supabase Postgres", "PostgreSQL", "bookings, providers, ambulances, hospitals, drivers, driver_locations")
        ComponentDb_Ext(redis, "Upstash Redis", "Redis REST", "driver:location:*, route_leg:*")
        Component_Ext(mapbox, "Mapbox", "HTTP API", "Directions, Matrix")
        Component_Ext(realtime, "Supabase Realtime", "Broadcast REST", "trip:{booking_id}, provider:{provider_id}")
    }

    Rel(cors, requestId, "next()")
    Rel(requestId, envCheck, "next()")
    Rel(envCheck, di, "next()")
    Rel(di, rateLimit, "next()")
    Rel(rateLimit, logging, "next()")
    Rel(logging, auth, "next()")
    Rel(auth, router, "jwtPayload")
    Rel(router, bookingRoutes, "/bookings")
    Rel(router, driverRoutes, "/driver")
    Rel(router, readRoutes, "/ambulances, /providers, /hospitals")
    Rel(bookingRoutes, bookingService, "create, assign, status")
    Rel(driverRoutes, driverService, "location, assignments")
    Rel(driverRoutes, bookingService, "getBooking for track")
    Rel(readRoutes, dispatchService, "findNearbyAmbulances")
    Rel(readRoutes, providerService, "search, nearby")
    Rel(readRoutes, hospitalService, "search, nearby")
    Rel(bookingService, bookingRepoIface, "book, assign")
    Rel(bookingService, realtimeIface, "broadcast")
    Rel(bookingService, distanceService, "two route legs")
    Rel(bookingService, errorHandler, "typed errors")
    Rel(distanceService, mapsCacheIface, "directions and cache")
    Rel(dispatchService, bookingRepoIface, "available ambulances")
    Rel(dispatchService, distanceService, "enrich")
    Rel(providerService, discoveryIface, "search")
    Rel(hospitalService, discoveryIface, "search")
    Rel(driverService, driverIface, "GPS, availability")
    Rel(driverService, bookingRepoIface, "assignments")
    Rel(driverService, realtimeIface, "location_update")
    Rel(supabaseRepos, bookingRepoIface, "implements")
    Rel(supabaseRepos, discoveryIface, "implements")
    Rel(realtimeRepo, realtimeIface, "implements")
    Rel(redisRepo, mapsCacheIface, "implements")
    Rel(mapboxRepo, mapsCacheIface, "implements")
    Rel(driverRepos, driverIface, "implements")
    Rel(supabaseRepos, postgres, "SQL")
    Rel(realtimeRepo, realtime, "channel.send")
    Rel(redisRepo, redis, "Redis REST")
    Rel(mapboxRepo, mapbox, "HTTP")
    Rel(driverRepos, postgres, "drivers, driver_locations")
    Rel(driverRepos, redis, "latest location")
    Rel(errorHandler, router, "JSON error response")
```

Every dependency in the graph is resolved by `diMiddleware`: each `get…` getter builds its repository or service once per request, so services only ever see the repository interfaces and never a concrete Supabase, Redis or Mapbox class.

---

## Booking flow — sequence

Two-step booking: `POST /bookings` persists a draft, `PUT /bookings/:id/assign` resolves both route legs, stores `route_geometry` and flips the booking to `confirmed` in one update.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (mobile app)
    participant Worker as Worker (Hono)
    participant BookingService
    participant Repo as BookingRepository
    participant Realtime as Supabase Realtime
    participant Mapbox

    Note over User,Repo: Step 1 — create the draft
    User->>Worker: POST /bookings {...}
    Worker->>Worker: auth + Zod validation
    Worker->>BookingService: createBooking(body, userId)
    BookingService->>BookingService: price from BOOKING_FEES
    BookingService->>Repo: createBooking(user_id, estimated_price)
    Repo->>Repo: insert with status draft
    Repo-->>BookingService: Booking (draft)
    BookingService->>Realtime: broadcastNewBooking(provider_id)
    Note over Realtime: provider:{provider_id}, event new_booking, sent via waitUntil
    Realtime-->>User: provider app sees the draft

    Note over User,Repo: Step 2 — assign ambulance, confirm
    User->>Worker: PUT /bookings/{id}/assign
    Worker->>BookingService: assignAmbulance(id, ambulance_id, driver_id?)
    BookingService->>Repo: getBooking(id), must be draft
    BookingService->>Repo: getAmbulance + getAmbulanceProviderLocation
    BookingService->>BookingService: access check, provider must match
    par two legs in parallel
        BookingService->>Mapbox: getRouteLeg(ambulance, pickup)
    and
        BookingService->>Mapbox: getRouteLeg(pickup, destination)
    end
    Mapbox-->>BookingService: distance, duration, encoded polyline
    Note over BookingService,Mapbox: legs cached as route_leg:{lat},{lng}:{lat},{lng}
    BookingService->>BookingService: build RouteGeometry, 2 legs + viewport
    BookingService->>Repo: assignAmbulance(route_geometry, driver_id)
    Repo->>Repo: update set status confirmed where status draft
    Repo-->>BookingService: Booking (confirmed)
    BookingService->>Realtime: broadcastAmbulanceAssigned
    Note over Realtime: trip:{booking_id}, event ambulance_assigned
    Realtime-->>User: polyline + ambulance on the map

    Note over User,Repo: Later transitions — en_route, arrived, to_hospital, completed
    User->>Worker: PUT /bookings/{id}/status
    Worker->>BookingService: updateStatus(id, status, payload)
    BookingService->>BookingService: access check, en_route needs provider/admin
    BookingService->>BookingService: VALID_TRANSITIONS allows target
    BookingService->>Repo: updateBookingStatus, then getBooking
    Repo-->>BookingService: Booking (new status)
    BookingService->>Realtime: broadcastStatusUpdated
    Note over Realtime: trip:{booking_id}, event status_updated
    Realtime-->>User: both apps follow the status

    Note over User,Repo: Cancellation — from any non-terminal status
    User->>Worker: PUT /bookings/{id}/status {cancelled}
    Worker->>BookingService: updateStatus(id, cancelled)
    BookingService->>Repo: updateBookingStatus, then getBooking
    BookingService->>Realtime: broadcastStatusUpdated
    Realtime-->>User: booking shows cancelled
```

`updateStatus` always re-reads the booking after the write and broadcasts the persisted row, so clients never see a status the database rejected.

---

## Booking state machine

Reproduced from `VALID_TRANSITIONS` in `backend/src/services/bookings.ts`: `draft` and the two terminal states, with `arrived` also allowed to complete directly.

```mermaid
stateDiagram-v2
    [*] --> draft : POST /bookings
    [*] --> confirmed : POST /bookings with ambulance_id
    draft --> confirmed : assign — owner, provider, driver or admin access, ambulance.provider_id must match
    draft --> cancelled
    confirmed --> en_route : provider or admin role, ambulance_id required
    confirmed --> cancelled
    en_route --> arrived
    en_route --> cancelled
    arrived --> to_hospital
    arrived --> completed
    arrived --> cancelled
    to_hospital --> completed
    to_hospital --> cancelled
    completed --> [*]
    cancelled --> [*]
```

Only `en_route` carries a role gate (`isProviderRole` or `isAdminRole`); the other transitions rely on `canAccessBooking`, which admits the booking owner, the matching provider, the assigned driver, and admins.
