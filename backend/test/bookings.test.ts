import { describe, it, expect, vi, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { Hono } from "hono";

const mockEnv = {
  ...env,
  ALLOWED_ORIGINS: "*",
  UPSTASH_REDIS_REST_URL: "http://localhost",
  UPSTASH_REDIS_REST_TOKEN: "test",
  SUPABASE_URL: "http://localhost",
  SUPABASE_SECRET_KEY: "test",
  MAPBOX_ACCESS_TOKEN: "test",
};
import bookingsApp from "../src/routes/bookings";
import { errorHandler } from "../src/middleware/error-handler";
import { ERROR_MESSAGES } from "../src/utils/constants";
import { AppVariables, JwtPayload } from "../src/types";
import { Bindings } from "../src/schemas/env";
import {
  IBookingRepository,
  IAmbulanceRepository,
  IRealtimeBroadcaster,
} from "../src/repositories/db";
import { BookingService } from "../src/services/bookings";
import { ISimulationService } from "../src/services/simulation";

interface MockDb {
  createBooking: ReturnType<typeof vi.fn>;
  getBooking: ReturnType<typeof vi.fn>;
  updateBookingStatus: ReturnType<typeof vi.fn>;
  assignAmbulance: ReturnType<typeof vi.fn>;
  getAmbulance: ReturnType<typeof vi.fn>;
  findAvailableAmbulances: ReturnType<typeof vi.fn>;
  broadcastTripLocation: ReturnType<typeof vi.fn>;
  getAmbulanceProviderLocation: ReturnType<typeof vi.fn>;
  getUserBookings: ReturnType<typeof vi.fn>;
  getConfirmedBookings: ReturnType<typeof vi.fn>;
  getBookingsByProvider: ReturnType<typeof vi.fn>;
  searchProviders: ReturnType<typeof vi.fn>;
  findProvidersByH3Indexes: ReturnType<typeof vi.fn>;
  searchHospitals: ReturnType<typeof vi.fn>;
  findHospitalsByH3Indexes: ReturnType<typeof vi.fn>;
  broadcastNewBooking: ReturnType<typeof vi.fn>;
}

// A minimal app wrapper to inject dependencies and middleware for testing
const createApp = (
  dbMock: MockDb,
  jwtPayloadMock: JwtPayload,
  simulationMock?: Partial<ISimulationService>,
) => {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

  // Inject mocks
  app.use("*", async (c, next) => {
    c.set("jwtPayload", jwtPayloadMock);

    const buildSimulationService = () => {
      const baseMock = {
        startSimulation: vi.fn(),
        advanceSimulation: vi.fn(),
        startSimulationForBooking: vi.fn(),
        stopSimulation: vi.fn().mockResolvedValue(undefined),
      };
      return (
        simulationMock ? { ...baseMock, ...simulationMock } : baseMock
      ) as ISimulationService;
    };

    c.set("getSimulationService", buildSimulationService);

    c.set("getBookingService", () => {
      return new BookingService(
        dbMock as IBookingRepository,
        dbMock as IAmbulanceRepository,
        dbMock as IRealtimeBroadcaster,
        buildSimulationService(),
      );
    });

    await next();
  });

  app.route("/bookings", bookingsApp);
  app.onError(errorHandler);
  return app;
};

describe("Bookings API", () => {
  let dbMock: MockDb;
  const mockUserId = "user-123";
  const mockDriverId = "driver-456";
  const mockOtherUserId = "user-789";
  const mockBookingId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    dbMock = {
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      updateBookingStatus: vi.fn(),
      assignAmbulance: vi.fn(),
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      broadcastTripLocation: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
      getUserBookings: vi.fn(),
      getConfirmedBookings: vi.fn(),
      searchProviders: vi.fn(),
      findProvidersByH3Indexes: vi.fn(),
      searchHospitals: vi.fn(),
      findHospitalsByH3Indexes: vi.fn(),
      getBookingsByProvider: vi.fn(),
      broadcastNewBooking: vi.fn(),
    };
  });

  describe("GET /bookings", () => {
    it("should return 200 with user bookings list", async () => {
      const mockBookings = [
        { id: mockBookingId, user_id: mockUserId, status: "confirmed" },
        {
          id: "223e4567-e89b-12d3-a456-426614174002",
          user_id: mockUserId,
          status: "draft",
        },
      ];
      dbMock.getUserBookings.mockResolvedValue(mockBookings);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request("/bookings?limit=10&offset=0", {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockBookings);
      expect(dbMock.getUserBookings).toHaveBeenCalledWith(mockUserId, 10, 0);
    });

    it("should return 200 with default pagination when limit/offset not provided", async () => {
      const mockBookings = [
        { id: mockBookingId, user_id: mockUserId, status: "confirmed" },
      ];
      dbMock.getUserBookings.mockResolvedValue(mockBookings);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request("/bookings", {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockBookings);
      expect(dbMock.getUserBookings).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        undefined,
      );
    });

    it("should return 200 with empty array when user has no bookings", async () => {
      dbMock.getUserBookings.mockResolvedValue([]);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request("/bookings?limit=10&offset=0", {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("should return 400 for invalid pagination params", async () => {
      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request("/bookings?limit=-1", {}, mockEnv);

      expect(res.status).toBe(400);
      expect(dbMock.getUserBookings).not.toHaveBeenCalled();
    });

    it("should return 500 on database error", async () => {
      dbMock.getUserBookings.mockRejectedValue(new Error("DB Error"));

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request("/bookings?limit=10&offset=0", {}, mockEnv);

      expect(res.status).toBe(500);
    });
  });

  describe("POST /bookings", () => {
    const validBookingPayload = {
      ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
      booking_type: "medis",
      estimated_price: 50000,
      patient_condition: "Stable",
      pickup_address: "123 Main St",
      pickup_lat: -6.2,
      pickup_lng: 106.8,
      pickup_h3: "878c106a4ffffff",
      destination_address: "456 Hospital Ave",
      destination_lat: -6.3,
      destination_lng: 106.9,
    };

    it("should return 201 and create confirmed booking when ambulance_id is provided", async () => {
      const mockCreatedBooking = {
        id: mockBookingId,
        ...validBookingPayload,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.createBooking.mockResolvedValue(mockCreatedBooking);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        "/bookings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBookingPayload),
        },
        mockEnv,
      );

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual(mockCreatedBooking);
      expect(dbMock.createBooking).toHaveBeenCalledWith({
        ...validBookingPayload,
        user_id: mockUserId,
      });
    });

    it("should return 201 and create draft booking when ambulance_id is omitted", async () => {
      const { ambulance_id: _ambulance_id, ...draftPayload } =
        validBookingPayload;
      const mockDraftBooking = {
        id: mockBookingId,
        ...draftPayload,
        user_id: mockUserId,
        status: "draft",
      };
      dbMock.createBooking.mockResolvedValue(mockDraftBooking);
      dbMock.broadcastNewBooking = vi.fn().mockResolvedValue(undefined);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        "/bookings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
        },
        mockEnv,
      );

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual(mockDraftBooking);
      expect(dbMock.createBooking).toHaveBeenCalledWith({
        ...draftPayload,
        user_id: mockUserId,
      });
      expect(dbMock.broadcastNewBooking).not.toHaveBeenCalled();
    });

    it("should broadcast to provider channel when draft booking is created with provider_id", async () => {
      const { ambulance_id: _ambulance_id, ...draftPayload } =
        validBookingPayload;

      const providerId = "223e4567-e89b-12d3-a456-426614174009";
      const payloadWithProvider = {
        ...draftPayload,
        provider_id: providerId,
      };

      const mockDraftBooking = {
        id: mockBookingId,
        ...payloadWithProvider,
        user_id: mockUserId,
        status: "draft",
      };
      dbMock.createBooking.mockResolvedValue(mockDraftBooking);
      dbMock.broadcastNewBooking = vi.fn().mockResolvedValue(undefined);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        "/bookings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadWithProvider),
        },
        mockEnv,
      );

      expect(res.status).toBe(201);
      expect(dbMock.broadcastNewBooking).toHaveBeenCalledWith(
        providerId,
        mockDraftBooking,
      );
    });

    it("should return 400 for validation errors", async () => {
      const invalidPayload = { ...validBookingPayload, pickup_lat: 1000 }; // Invalid lat

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        "/bookings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidPayload),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(dbMock.createBooking).not.toHaveBeenCalled();
    });

    it("should return 500 on database error", async () => {
      dbMock.createBooking.mockRejectedValue(new Error("DB Error"));

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        "/bookings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBookingPayload),
        },
        mockEnv,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });

  describe("GET /bookings/:id", () => {
    it("should return 200 and booking data when requested by the owner", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/${mockBookingId}`, {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockBooking);
      expect(dbMock.getBooking).toHaveBeenCalledWith(mockBookingId);
    });

    it("should return 200 and booking data when requested by a driver", async () => {
      // Driver does not own the booking, but has driver role and matching provider_id
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        provider_id: "prov-123",
        driver_id: mockDriverId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, {
        sub: mockDriverId,
        app_metadata: { role: "driver", provider_id: "prov-123" },
      });
      const res = await app.request(`/bookings/${mockBookingId}`, {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockBooking);
    });

    it("should return 200 and booking data when requested by a driver via app_metadata role", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        provider_id: "prov-123",
        driver_id: mockDriverId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, {
        sub: mockDriverId,
        app_metadata: { role: "driver", provider_id: "prov-123" },
      });
      const res = await app.request(`/bookings/${mockBookingId}`, {}, mockEnv);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockBooking);
    });

    it("should handle invalid app_metadata gracefully (missing role)", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, {
        sub: mockOtherUserId,
        app_metadata: { role: 123 }, // Invalid role type
      } as unknown as JwtPayload);
      const res = await app.request(`/bookings/${mockBookingId}`, {}, mockEnv);

      expect(res.status).toBe(403); // Falls back to forbidden
    });

    it("should handle null app_metadata gracefully", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, {
        sub: mockOtherUserId,
        app_metadata: null,
      } as unknown as JwtPayload);
      const res = await app.request(`/bookings/${mockBookingId}`, {}, mockEnv);

      expect(res.status).toBe(403);
    });

    it("should return 404 when the booking does not exist", async () => {
      dbMock.getBooking.mockResolvedValue(null);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/${mockBookingId}`, {}, mockEnv);

      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    });

    it("should return 403 when requested by a user who is not the owner (and not a driver)", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockOtherUserId });
      const res = await app.request(`/bookings/${mockBookingId}`, {}, mockEnv);

      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    });

    it("should return 400 for an invalid UUID format", async () => {
      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/invalid-id`, {}, mockEnv);

      expect(res.status).toBe(400);
    });

    it("should return 500 on database error during GET", async () => {
      dbMock.getBooking.mockRejectedValue(new Error("Database failure"));

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/${mockBookingId}`, {}, mockEnv);

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });

  describe("PUT /bookings/:id/status", () => {
    it("should return 200 on successful status update by driver", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        provider_id: "prov-123",
        driver_id: mockDriverId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.updateBookingStatus.mockResolvedValue(undefined);

      const startSimulationForBooking = vi.fn().mockResolvedValue(true);
      const dispatchMock = { startSimulationForBooking };
      const app = createApp(
        dbMock,
        {
          sub: mockDriverId,
          app_metadata: { role: "driver", provider_id: "prov-123" },
        },
        dispatchMock,
      );
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "en_route" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
        mockBookingId,
        "en_route",
      );
      expect(startSimulationForBooking).toHaveBeenCalledWith(
        mockBooking,
        mockDriverId,
      );
    });

    it("should return 500 when simulation setup fails", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        provider_id: "prov-123",
        driver_id: mockDriverId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const startSimulationForBooking = vi.fn().mockResolvedValue(false);
      const dispatchMock = { startSimulationForBooking };
      const app = createApp(
        dbMock,
        {
          sub: mockDriverId,
          app_metadata: { role: "driver", provider_id: "prov-123" },
        },
        dispatchMock,
      );
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "en_route" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should return 403 when non-driver/non-provider sets en_route", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "en_route" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(403);
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should return 200 when provider sets en_route", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        provider_id: "prov-123",
        driver_id: mockDriverId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.updateBookingStatus.mockResolvedValue(undefined);

      const startSimulationForBooking = vi.fn().mockResolvedValue(true);
      const dispatchMock = { startSimulationForBooking };
      const app = createApp(
        dbMock,
        {
          sub: mockOtherUserId,
          app_metadata: { role: "provider", provider_id: "prov-123" },
        },
        dispatchMock,
      );
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "en_route" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
        mockBookingId,
        "en_route",
      );
      expect(startSimulationForBooking).toHaveBeenCalledWith(
        mockBooking,
        mockDriverId,
      );
    });

    it("should return 400 when provider sets en_route without assigned driver", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        provider_id: "prov-123",
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const startSimulationForBooking = vi.fn().mockResolvedValue(true);
      const simulationServiceMock = { startSimulationForBooking };
      const app = createApp(
        dbMock,
        {
          sub: mockOtherUserId,
          app_metadata: { role: "provider", provider_id: "prov-123" },
        },
        simulationServiceMock,
      );

      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "en_route" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(startSimulationForBooking).not.toHaveBeenCalled();
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid status enums", async () => {
      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "INVALID_STATUS" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should return 200 for valid status transition draft to cancelled", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "draft",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.updateBookingStatus.mockResolvedValue(undefined);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
        mockBookingId,
        "cancelled",
      );
    });

    it("should return 404 if the booking doesn't exist", async () => {
      dbMock.getBooking.mockResolvedValue(null);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "en_route" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should return 403 if the user is not authorized to modify the booking", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockOtherUserId }); // not the owner, not a driver
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "en_route" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(403);
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should return 500 on database error during PUT", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.updateBookingStatus.mockRejectedValue(new Error("Update failed"));

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });

    it("should return 400 for invalid status transition", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "draft",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "arrived" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should return 400 when transitioning from a terminal state", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "completed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "draft" }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });
  });

  it("should return 200 for en_route to arrived transition", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      provider_id: "prov-123",
      driver_id: mockDriverId,
      status: "en_route",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);
    dbMock.updateBookingStatus.mockResolvedValue(undefined);
    const dispatchMock = { startSimulationForBooking: vi.fn() };
    const app = createApp(
      dbMock,
      {
        sub: mockDriverId,
        app_metadata: { role: "driver", provider_id: "prov-123" },
      },
      dispatchMock,
    );
    const res = await app.request(`/bookings/${mockBookingId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "arrived" }),
    });
    expect(res.status).toBe(200);
    expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "arrived",
    );
  });

  it("should return 200 for arrived to completed transition", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      status: "arrived",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);
    dbMock.updateBookingStatus.mockResolvedValue(undefined);

    const app = createApp(dbMock, { sub: mockUserId });
    const res = await app.request(
      `/bookings/${mockBookingId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "completed",
    );
  });

  it("should return 200 for arrived to to_hospital transition", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      status: "arrived",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);
    dbMock.updateBookingStatus.mockResolvedValue(undefined);

    const app = createApp(dbMock, { sub: mockUserId });
    const res = await app.request(
      `/bookings/${mockBookingId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "to_hospital" }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "to_hospital",
    );
  });

  it("should return 200 for to_hospital to completed transition", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      status: "to_hospital",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);
    dbMock.updateBookingStatus.mockResolvedValue(undefined);

    const app = createApp(dbMock, { sub: mockUserId });
    const res = await app.request(
      `/bookings/${mockBookingId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "completed",
    );
  });

  it("should return 200 for confirmed to cancelled transition", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      status: "confirmed",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);
    dbMock.updateBookingStatus.mockResolvedValue(undefined);

    const app = createApp(dbMock, { sub: mockUserId });
    const res = await app.request(`/bookings/${mockBookingId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(res.status).toBe(200);
    expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "cancelled",
    );
  });

  it("should return 500 and not update booking if stopSimulation fails on cancellation", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      status: "confirmed",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);

    const stopSimulation = vi
      .fn()
      .mockRejectedValue(new Error("Redis timeout during cleanup"));

    const app = createApp(dbMock, { sub: mockUserId }, { stopSimulation });
    const res = await app.request(`/bookings/${mockBookingId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });

    expect(res.status).toBe(500);
    expect(stopSimulation).toHaveBeenCalledWith(mockBookingId);
    expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
  });

  it("should return 200 for en_route to cancelled transition", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      status: "en_route",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);
    dbMock.updateBookingStatus.mockResolvedValue(undefined);

    const app = createApp(dbMock, { sub: mockUserId });
    const res = await app.request(`/bookings/${mockBookingId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(res.status).toBe(200);
    expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "cancelled",
    );
  });

  it("should return 200 for arrived to cancelled transition", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      status: "arrived",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);
    dbMock.updateBookingStatus.mockResolvedValue(undefined);

    const app = createApp(dbMock, { sub: mockUserId });
    const res = await app.request(`/bookings/${mockBookingId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(res.status).toBe(200);
    expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "cancelled",
    );
  });

  it("should return 200 for to_hospital to cancelled transition", async () => {
    const mockBooking = {
      id: mockBookingId,
      user_id: mockUserId,
      status: "to_hospital",
    };
    dbMock.getBooking.mockResolvedValue(mockBooking);
    dbMock.updateBookingStatus.mockResolvedValue(undefined);

    const app = createApp(dbMock, { sub: mockUserId });
    const res = await app.request(`/bookings/${mockBookingId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(res.status).toBe(200);
    expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "cancelled",
    );
  });

  describe("PUT /bookings/:id/assign", () => {
    it("should return 404 if assigned ambulance does not exist for general draft", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "draft",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.getAmbulance.mockResolvedValue(null);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(dbMock.assignAmbulance).not.toHaveBeenCalled();
    });

    it("should sync provider_id from ambulance when assigning to general draft", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "draft",
      };
      const mockAmbulance = {
        id: "223e4567-e89b-12d3-a456-426614174001",
        provider_id: "prov-new-123",
      };

      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.getAmbulance.mockResolvedValue(mockAmbulance);
      dbMock.assignAmbulance.mockResolvedValue({
        ...mockBooking,
        ambulance_id: mockAmbulance.id,
        provider_id: mockAmbulance.provider_id,
        status: "confirmed",
      });

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: mockAmbulance.id,
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(dbMock.assignAmbulance).toHaveBeenCalledWith(
        mockBookingId,
        mockAmbulance.id,
        mockAmbulance.provider_id,
      );
    });

    it("should return 200 with updated booking on successful ambulance assignment", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "draft",
        booking_type: "medis",
        patient_condition: "test",
        pickup_address: "test",
        pickup_lat: -6.2,
        pickup_lng: 106.8,
        pickup_h3: "876526b33ffffff",
        destination_address: "test",
        destination_lat: -6.21,
        destination_lng: 106.82,
        created_at: "2025-01-01T00:00:00Z",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.getAmbulance.mockResolvedValue({
        id: "223e4567-e89b-12d3-a456-426614174001",
        provider_id: "prov-123",
      });
      const updatedBooking = {
        ...mockBooking,
        ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
        status: "confirmed",
      };
      dbMock.assignAmbulance.mockResolvedValue(updatedBooking);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({
        id: mockBookingId,
        status: "confirmed",
        ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
      });
      expect(dbMock.assignAmbulance).toHaveBeenCalledWith(
        mockBookingId,
        "223e4567-e89b-12d3-a456-426614174001",
        "prov-123",
      );
    });

    it("should return 400 if booking is not in draft status", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
      expect(dbMock.assignAmbulance).not.toHaveBeenCalled();
    });

    it("should return 200 if authorized as provider with matching provider_id", async () => {
      const providerId = "prov-123";
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        provider_id: providerId,
        status: "draft",
        booking_type: "medis",
        patient_condition: "test",
        pickup_address: "test",
        pickup_lat: -6.2,
        pickup_lng: 106.8,
        pickup_h3: "876526b33ffffff",
        destination_address: "test",
        destination_lat: -6.21,
        destination_lng: 106.82,
        created_at: "2025-01-01T00:00:00Z",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.getAmbulance.mockResolvedValue({
        id: "223e4567-e89b-12d3-a456-426614174001",
        provider_id: providerId,
      });
      const updatedBooking = {
        ...mockBooking,
        ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
        status: "confirmed",
      };
      dbMock.assignAmbulance.mockResolvedValue(updatedBooking);

      const app = createApp(dbMock, {
        sub: mockOtherUserId,
        app_metadata: { role: "provider", provider_id: providerId },
      });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(dbMock.assignAmbulance).toHaveBeenCalledWith(
        mockBookingId,
        "223e4567-e89b-12d3-a456-426614174001",
      );
    });

    it("should return 403 if provider_id does not match", async () => {
      const providerId = "prov-123";
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        provider_id: "prov-999", // Different provider
        status: "draft",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, {
        sub: mockOtherUserId,
        app_metadata: { role: "provider", provider_id: providerId },
      });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(403);
      expect(dbMock.assignAmbulance).not.toHaveBeenCalled();
    });

    it("should return 403 if not authorized", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "draft",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockOtherUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(403);
      expect(dbMock.assignAmbulance).not.toHaveBeenCalled();
    });

    it("should return 404 if booking not found", async () => {
      dbMock.getBooking.mockResolvedValue(null);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(404);
      expect(dbMock.assignAmbulance).not.toHaveBeenCalled();
    });

    it("should return 500 on database error", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "draft",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);
      dbMock.getAmbulance.mockResolvedValue({
        id: "223e4567-e89b-12d3-a456-426614174001",
        provider_id: "prov-123",
      });
      dbMock.assignAmbulance.mockRejectedValue(new Error("Assign failed"));

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(
        `/bookings/${mockBookingId}/assign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });
});
