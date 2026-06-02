import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { SimulationService } from "../src/services/simulation";
import { IGenericCache } from "../src/repositories/generic-cache";
import { IBookingRepository } from "../src/repositories/booking";
import { IAmbulanceRepository } from "../src/repositories/ambulance";
import { IRealtimeBroadcaster } from "../src/repositories/realtime";
import { Booking } from "../src/types";

describe("SimulationService", () => {
  let mockCache: Mocked<IGenericCache>;
  let mockBookingRepo: Mocked<IBookingRepository>;
  let mockAmbulanceRepo: Mocked<IAmbulanceRepository>;
  let mockRealtime: Mocked<IRealtimeBroadcaster>;
  let service: SimulationService;

  const mockBooking: Booking = {
    id: "booking_1",
    ambulance_id: "amb_1",
    booking_type: "medis",
    patient_condition: "Stable",
    pickup_address: "User Home",
    pickup_lat: -6.1,
    pickup_lng: 106.8,
    pickup_h3: "878c106a4ffffff",
    destination_address: "Hospital",
    destination_lat: -6.2,
    destination_lng: 106.9,
    status: "confirmed",
    created_at: new Date().toISOString(),
    user_id: "user_1",
  };

  beforeEach(() => {
    mockCache = {
      set: vi.fn(),
      get: vi.fn(),
      mget: vi.fn(),
      getDriversInBucket: vi.fn(),
      updateDriverLocation: vi.fn(),
      getDriverLocation: vi.fn(),
      getDriverLocations: vi.fn(),
      addDriverToBucket: vi.fn(),
      removeDriverFromBucket: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
      incr: vi.fn(),
      del: vi.fn(),
      rpush: vi.fn(),
      lpop: vi.fn(),
      llen: vi.fn(),
    } as unknown as Mocked<IGenericCache>;
    mockBookingRepo = {
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      updateBookingStatus: vi.fn(),
      assignAmbulance: vi.fn(),
      getConfirmedBookings: vi.fn(),
      getUserBookings: vi.fn(),
      getBookingsByProvider: vi.fn(),
    } as Mocked<IBookingRepository>;
    mockAmbulanceRepo = {
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
    } as Mocked<IAmbulanceRepository>;
    mockRealtime = {
      broadcastTripLocation: vi.fn(),
      broadcastNewBooking: vi.fn(),
    } as Mocked<IRealtimeBroadcaster>;
    service = new SimulationService(
      mockCache,
      mockBookingRepo,
      mockAmbulanceRepo,
      mockRealtime,
    );
  });

  it("should start simulation by pushing points to cache", async () => {
    const bookingWithRoute: Booking = {
      ...mockBooking,
      route_geometry: {
        total_distance_meters: 1000,
        total_duration_seconds: 100,
        combined_viewport: {
          low: { lat: 0, lng: 0 },
          high: { lat: 1, lng: 1 },
        },
        legs: [{ sequence: 1, encoded_polyline: "a~l~Fjk_uO~clMmhwD" }],
      },
    };

    await service.startSimulation(bookingWithRoute);

    expect(
      mockAmbulanceRepo.getAmbulanceProviderLocation,
    ).not.toHaveBeenCalled();
    expect(mockCache.rpush).toHaveBeenCalled();
    const [key, ...args] = mockCache.rpush.mock.calls[0];
    expect(key).toBe("sim:route:booking_1");
    expect(args.length).toBeGreaterThan(0);
    expect(mockCache.expire).toHaveBeenCalledWith("sim:route:booking_1", 3600);
  });

  it("should not start simulation if route_geometry is missing", async () => {
    await service.startSimulation(mockBooking);

    expect(mockCache.rpush).not.toHaveBeenCalled();
  });

  it("should advance simulation and broadcast location", async () => {
    const mockBookingId = "booking_1";
    const mockRoute = [
      { lat: -6.05, lng: 106.75 },
      { lat: -6.1, lng: 106.8 },
    ];
    mockBookingRepo.getBooking.mockResolvedValue({
      id: mockBookingId,
      status: "en_route",
      user_id: "user_1",
      ambulance_id: "amb_1",
    } as Booking);

    mockCache.lpop.mockResolvedValue(mockRoute[0]);
    mockCache.llen.mockResolvedValue(1);

    await service.advanceSimulation(mockBookingId);

    expect(mockRealtime.broadcastTripLocation).toHaveBeenCalledWith(
      mockBookingId,
      {
        lat: -6.05,
        lng: 106.75,
      },
    );
    expect(mockCache.expire).toHaveBeenCalledWith("sim:route:booking_1", 3600);
  });

  it("should update status to arrived when simulation reaches end", async () => {
    const mockBookingId = "booking_1";
    const mockRoute = [{ lat: -6.1, lng: 106.8 }];
    mockBookingRepo.getBooking.mockResolvedValue({
      id: mockBookingId,
      status: "en_route",
      user_id: "user_1",
      ambulance_id: "amb_1",
    } as Booking);

    mockCache.lpop.mockResolvedValue(mockRoute[0]);
    mockCache.llen.mockResolvedValue(0);

    await service.advanceSimulation(mockBookingId);

    expect(mockBookingRepo.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "arrived",
    );
    expect(mockCache.del).toHaveBeenCalledWith(`sim:route:${mockBookingId}`);
  });

  it("should not set any simulation keys when booking is invalid", async () => {
    const invalidBooking = { ...mockBooking, route_geometry: undefined };

    await service.startSimulationForBooking(invalidBooking);

    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it("should clean up simulation keys when booking is null", async () => {
    const mockBookingId = "booking_1";
    mockBookingRepo.getBooking.mockResolvedValue(null);
    mockCache.del.mockResolvedValue(undefined);

    await service.advanceSimulation(mockBookingId);

    expect(mockCache.del).toHaveBeenCalledWith("sim:route:booking_1");
    expect(mockRealtime.broadcastTripLocation).not.toHaveBeenCalled();
  });
});
