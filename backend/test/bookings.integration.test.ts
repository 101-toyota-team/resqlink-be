import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import bookingsApp from "../src/routes/bookings";
import { errorHandler } from "../src/middleware/error-handler";
import { AppVariables, JwtPayload } from "../src/types";
import { Bindings } from "../src/schemas/env";
import {
  IBookingRepository,
  IAmbulanceRepository,
  IProviderRepository,
  IHospitalRepository,
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
  broadcastNewBooking: ReturnType<typeof vi.fn>;
  getUserBookings: ReturnType<typeof vi.fn>;
  getConfirmedBookings: ReturnType<typeof vi.fn>;
  getBookingsByProvider: ReturnType<typeof vi.fn>;
  findAvailableAmbulances: ReturnType<typeof vi.fn>;
  getAmbulanceProviderLocation: ReturnType<typeof vi.fn>;
  broadcastTripLocation: ReturnType<typeof vi.fn>;
  searchProviders: ReturnType<typeof vi.fn>;
  findProvidersByH3Indexes: ReturnType<typeof vi.fn>;
  searchHospitals: ReturnType<typeof vi.fn>;
  findHospitalsByH3Indexes: ReturnType<typeof vi.fn>;
}

const createApp = (
  dbMock: MockDb,
  jwtPayloadMock: JwtPayload,
  simulationMock: Partial<ISimulationService>,
) => {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

  app.use("*", async (c, next) => {
    c.set("jwtPayload", jwtPayloadMock);

    const buildSimulationService = () => {
      return {
        startSimulation: vi.fn(),
        advanceSimulation: vi.fn(),
        startSimulationForBooking: vi.fn(),
        stopSimulation: vi.fn(),
        ...simulationMock,
      } as ISimulationService;
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

describe("Bookings Integration Lifecycle", () => {
  let dbMock: MockDb;
  const mockUserId = "user-123";
  const mockBookingId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAmbulanceId = "223e4567-e89b-12d3-a456-426614174001";

  beforeEach(() => {
    dbMock = {
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      updateBookingStatus: vi.fn(),
      assignAmbulance: vi.fn(),
      getAmbulance: vi.fn(),
      broadcastNewBooking: vi.fn(),
      getUserBookings: vi.fn(),
      getConfirmedBookings: vi.fn(),
      getBookingsByProvider: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
      broadcastTripLocation: vi.fn(),
      searchProviders: vi.fn(),
      findProvidersByH3Indexes: vi.fn(),
      searchHospitals: vi.fn(),
      findHospitalsByH3Indexes: vi.fn(),
    };
  });

  it("should complete full lifecycle (Create -> Assign -> Cancel) and cleanup simulation", async () => {
    const stopSimulation = vi.fn().mockResolvedValue(undefined);
    const simulationMock = { stopSimulation };
    const app = createApp(dbMock, { sub: mockUserId }, simulationMock);

    // 1. Create Draft Booking
    const draftPayload = {
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
    dbMock.createBooking.mockResolvedValue({
      id: mockBookingId,
      ...draftPayload,
      status: "draft",
    });

    const resCreate = await app.request("/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftPayload),
    });
    expect(resCreate.status).toBe(201);

    // 2. Assign Ambulance
    dbMock.getBooking.mockResolvedValue({
      id: mockBookingId,
      status: "draft",
      user_id: mockUserId,
    });
    dbMock.getAmbulance.mockResolvedValue({
      id: mockAmbulanceId,
      provider_id: "prov-123",
    });
    dbMock.assignAmbulance.mockResolvedValue({
      id: mockBookingId,
      status: "confirmed",
      ambulance_id: mockAmbulanceId,
      user_id: mockUserId,
    });

    const resAssign = await app.request(`/bookings/${mockBookingId}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ambulance_id: mockAmbulanceId }),
    });
    expect(resAssign.status).toBe(200);

    // 3. Cancel Booking
    dbMock.getBooking.mockResolvedValue({
      id: mockBookingId,
      status: "confirmed",
      user_id: mockUserId,
    });
    dbMock.updateBookingStatus.mockResolvedValue(undefined);

    const resCancel = await app.request(`/bookings/${mockBookingId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(resCancel.status).toBe(200);

    // 4. Verify cleanup — simulation.stopSimulation was called with bookingId only
    expect(stopSimulation).toHaveBeenCalledWith(mockBookingId);
  });
});
