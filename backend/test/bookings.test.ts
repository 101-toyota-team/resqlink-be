import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import bookingsApp from "../src/routes/bookings";
import { ERROR_MESSAGES } from "../src/utils/constants";
import { AppVariables, JwtPayload } from "../src/types";
import { Bindings } from "../src/schemas/env";
import { IPersistenceRepository } from "../src/repositories/db";

interface MockDb {
  createBooking: ReturnType<typeof vi.fn>;
  getBooking: ReturnType<typeof vi.fn>;
  updateBookingStatus: ReturnType<typeof vi.fn>;
}

// A minimal app wrapper to inject dependencies and middleware for testing
const createApp = (
  dbMock: MockDb,
  jwtPayloadMock: JwtPayload,
  dispatchMock?: { startSimulationForBooking: ReturnType<typeof vi.fn> },
) => {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

  // Inject mocks
  app.use("*", async (c, next) => {
    c.set("getDb", () => dbMock as unknown as IPersistenceRepository);
    c.set("jwtPayload", jwtPayloadMock);
    c.set("getDispatchService", () => {
      const baseMock = {
        findNearbyDrivers: vi.fn(),
        updateDriverStatus: vi.fn(),
        startSimulation: vi.fn(),
        advanceSimulation: vi.fn(),
        startSimulationForBooking: vi.fn(),
      };
      return dispatchMock
        ? ({ ...baseMock, ...dispatchMock } as any)
        : (baseMock as any);
    });
    await next();
  });

  app.route("/bookings", bookingsApp);
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
    };
  });

  describe("POST /bookings", () => {
    const validBookingPayload = {
      ambulance_id: "223e4567-e89b-12d3-a456-426614174001",
      booking_type: "medis",
      patient_condition: "Stable",
      pickup_address: "123 Main St",
      pickup_lat: -6.2,
      pickup_lng: 106.8,
      pickup_h3: "878c84c525fff",
      destination_address: "456 Hospital Ave",
      destination_lat: -6.3,
      destination_lng: 106.9,
    };

    it("should return 201 and created booking on success", async () => {
      const mockCreatedBooking = {
        id: mockBookingId,
        ...validBookingPayload,
        user_id: mockUserId,
        status: "pending",
      };
      dbMock.createBooking.mockResolvedValue(mockCreatedBooking);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request("/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBookingPayload),
      });

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual(mockCreatedBooking);
      expect(dbMock.createBooking).toHaveBeenCalledWith({
        ...validBookingPayload,
        user_id: mockUserId,
      });
    });

    it("should return 400 for validation errors", async () => {
      const invalidPayload = { ...validBookingPayload, pickup_lat: 1000 }; // Invalid lat

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request("/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidPayload),
      });

      expect(res.status).toBe(400);
      expect(dbMock.createBooking).not.toHaveBeenCalled();
    });

    it("should return 500 on database error", async () => {
      dbMock.createBooking.mockRejectedValue(new Error("DB Error"));

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request("/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBookingPayload),
      });

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.BOOKING_FAILED);
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
      const res = await app.request(`/bookings/${mockBookingId}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockBooking);
      expect(dbMock.getBooking).toHaveBeenCalledWith(mockBookingId);
    });

    it("should return 200 and booking data when requested by a driver", async () => {
      // Driver does not own the booking, but has driver role
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, { sub: mockDriverId, role: "driver" });
      const res = await app.request(`/bookings/${mockBookingId}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockBooking);
    });

    it("should return 200 and booking data when requested by a driver via app_metadata role", async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        status: "confirmed",
      };
      dbMock.getBooking.mockResolvedValue(mockBooking);

      const app = createApp(dbMock, {
        sub: mockDriverId,
        app_metadata: { role: "driver" },
      });
      const res = await app.request(`/bookings/${mockBookingId}`);

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
      });
      const res = await app.request(`/bookings/${mockBookingId}`);

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
      });
      const res = await app.request(`/bookings/${mockBookingId}`);

      expect(res.status).toBe(403);
    });

    it("should return 404 when the booking does not exist", async () => {
      dbMock.getBooking.mockResolvedValue(null);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/${mockBookingId}`);

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
      const res = await app.request(`/bookings/${mockBookingId}`);

      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    });

    it("should return 400 for an invalid UUID format", async () => {
      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/invalid-id`);

      expect(res.status).toBe(400);
    });

    it("should return 500 on database error during GET", async () => {
      dbMock.getBooking.mockRejectedValue(new Error("Database failure"));

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/${mockBookingId}`);

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });

  describe("PUT /bookings/:id/status", () => {
    it("should return 200 on successful status update", async () => {
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
        body: JSON.stringify({ status: "en_route" }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string };
      expect(json.status).toBe("ok");
      expect(dbMock.updateBookingStatus).toHaveBeenCalledWith(
        mockBookingId,
        "en_route",
      );
    });

    it("should return 400 for invalid status enums", async () => {
      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/${mockBookingId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INVALID_STATUS" }),
      });

      expect(res.status).toBe(400);
      expect(dbMock.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should return 404 if the booking doesn't exist", async () => {
      dbMock.getBooking.mockResolvedValue(null);

      const app = createApp(dbMock, { sub: mockUserId });
      const res = await app.request(`/bookings/${mockBookingId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "en_route" }),
      });

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
      const res = await app.request(`/bookings/${mockBookingId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "en_route" }),
      });

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
      const res = await app.request(`/bookings/${mockBookingId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "en_route" }),
      });

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });
});
