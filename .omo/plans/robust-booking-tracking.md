# Work Plan: Robust Booking & Tracking

This plan outlines the enhancements to make the "Create Booking" and "Driver Tracking" (Provider -> User) flows production-ready, focusing on robustness, strict error handling, and state consistency.

## Context & Objectives
- **Goal**: Implement a robust two-step booking flow with automated tracking from the provider to the pickup location.
- **Priority**: High. Ensuring price integrity and tracking reliability.
- **Constraints**: Backend-only implementation (no Driver App UI). Strict fail-fast on Maps API errors.

## Technical Decisions
- **Pricing**: Flat fee based on `booking_type` (e.g., `sosial: 0`, others fixed).
- **Tracking**: `en_route` status triggers simulation from the ambulance's current/provider location to the pickup point.
- **Cancellation**: Immediate purge of simulation state in Redis upon booking cancellation.
- **Error Handling**: Fail-fast on Google Maps API failures during booking creation/updates.

## Database & State Changes
- **Supabase**: `bookings.estimated_price` will be populated on creation.
- **Redis**: `sim:*` keys will have strict management and immediate cleanup.

## TODOs
1. [x] src/utils/constants.ts: Define `BOOKING_FEES` map (e.g., `medis: 50000, sosial: 0`) and `ERROR_MESSAGES.MAPS_API_FAILURE`.
2. [x] src/schemas/index.ts: Update `bookingSchema` to ensure `booking_type` is validated against `BOOKING_FEES` keys.
3. [x] src/types.ts: Ensure `BookingData` includes `estimated_price` as an optional field if needed for internal typing.
4. [x] src/services/bookings.ts: Update `createBooking` to set `estimated_price` from `BOOKING_FEES`.
5. [x] src/services/bookings.ts: Implement strict error handling for the `draft` -> `assign` transition. Validate `provider_id` exists before allowing assignment.
6. [x] src/services/simulation.ts: Add `stopSimulation(bookingId: string, driverId: string)` method to purge `sim:*` keys.
7. [x] src/services/simulation.ts: Update `startSimulation` to use the ambulance's current location (from Redis) as the origin, falling back to provider location.
8. [x] src/services/bookings.ts: Update `updateStatus` to invoke `simulation.stopSimulation` when a booking is `cancelled`.
9. [x] test/bookings.integration.test.ts: Add a full lifecycle test (Create -> Assign -> Cancel) verifying Redis cleanup.
10. [x] test/simulation.test.ts: Add a test for `advanceSimulation` with a mocked Maps route.

## Final Verification Wave
F1. [x] Automated integration test: Create -> Assign -> Cancel -> Verify Redis Purge.
F2. [x] Simulation test: `driver/ping` advances steps and broadcasts coordinates.
F3. [x] Price integrity check: Verify `estimated_price` matches `BOOKING_FEES` constant.
F4. [ ] [EXPLICIT USER APPROVAL]: All systems verified?



