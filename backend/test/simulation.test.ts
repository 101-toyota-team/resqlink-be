import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { SimulationService } from "../src/services/simulation";
import { ICacheRepository } from "../src/repositories/cache";
import { IGenericCache } from "../src/repositories/generic-cache";
import { IBookingRepository } from "../src/repositories/booking";
import { IAmbulanceRepository } from "../src/repositories/ambulance";
import { IRealtimeBroadcaster } from "../src/repositories/realtime";
import { IMapsRepository } from "../src/repositories/maps";
import { Booking } from "../src/types";

describe("SimulationService", () => {
  let mockCache: Mocked<IGenericCache & ICacheRepository>;
  let mockBookingRepo: Mocked<IBookingRepository>;
  let mockAmbulanceRepo: Mocked<IAmbulanceRepository>;
  let mockRealtime: Mocked<IRealtimeBroadcaster>;
  let mockMaps: Mocked<IMapsRepository>;
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
    } as unknown as Mocked<IGenericCache & ICacheRepository>;
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
    mockMaps = {
      getDirections: vi.fn(),
      getDistanceMatrix: vi.fn(),
    } as Mocked<IMapsRepository>;
    service = new SimulationService(
      mockCache,
      mockBookingRepo,
      mockAmbulanceRepo,
      mockRealtime,
      mockMaps,
    );
  });

  it("should start simulation by fetching directions and storing in cache", async () => {
    mockAmbulanceRepo.getAmbulanceProviderLocation.mockResolvedValue({
      lat: -6.0,
      lng: 106.7,
    });
    mockMaps.getDirections.mockResolvedValue({
      status: "OK",
      routes: [
        {
          bounds: {},
          copyrights: "",
          legs: [],
          overview_polyline: { points: "a~l~Fjk_uO~clMmhwD" },
          summary: "",
          warnings: [],
          waypoint_order: [],
        },
      ],
    });

    await service.startSimulation(mockBooking);

    expect(mockAmbulanceRepo.getAmbulanceProviderLocation).toHaveBeenCalledWith(
      "amb_1",
    );
    expect(mockMaps.getDirections).toHaveBeenCalled();
    expect(mockCache.set).toHaveBeenCalledWith(
      "sim:route:booking_1",
      expect.any(Array),
      3600,
    );
    expect(mockCache.set).toHaveBeenCalledWith("sim:step:booking_1", 0, 3600);
  });

  it("should not start simulation if directions are empty", async () => {
    mockAmbulanceRepo.getAmbulanceProviderLocation.mockResolvedValue({
      lat: -6.0,
      lng: 106.7,
    });
    mockMaps.getDirections.mockResolvedValue({
      status: "OK",
      routes: [
        {
          bounds: {},
          copyrights: "",
          legs: [],
          overview_polyline: { points: "" },
          summary: "",
          warnings: [],
          waypoint_order: [],
        },
      ],
    });

    await service.startSimulation(mockBooking);

    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it("should stop simulation gracefully if cache is missing route or step", async () => {
    const mockDriverId = "driver_1";
    mockCache.get.mockImplementation(async (key: string) => {
      if (key === `sim:active:${mockDriverId}`) return "booking_1";
      return null;
    });

    await service.advanceSimulation(mockDriverId);

    expect(mockRealtime.broadcastTripLocation).not.toHaveBeenCalled();
    expect(mockBookingRepo.updateBookingStatus).not.toHaveBeenCalled();
  });

  it("should advance simulation and broadcast location", async () => {
    const mockDriverId = "driver_1";
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

    mockCache.get.mockImplementation(async (key: string) => {
      if (key === `sim:active:${mockDriverId}`) return mockBookingId;
      if (key === `sim:route:${mockBookingId}`) return mockRoute;
      if (key === `sim:step:${mockBookingId}`) return 0;
      return null;
    });

    await service.advanceSimulation(mockDriverId);

    expect(mockRealtime.broadcastTripLocation).toHaveBeenCalledWith(
      mockBookingId,
      {
        lat: -6.05,
        lng: 106.75,
      },
    );
    expect(mockCache.set).toHaveBeenCalledWith("sim:step:booking_1", 1, 3600);
  });

  it("should update status to arrived when simulation reaches end", async () => {
    const mockDriverId = "driver_1";
    const mockBookingId = "booking_1";
    const mockRoute = [{ lat: -6.1, lng: 106.8 }];
    mockBookingRepo.getBooking.mockResolvedValue({
      id: mockBookingId,
      status: "en_route",
      user_id: "user_1",
      ambulance_id: "amb_1",
    } as Booking);

    mockCache.get.mockImplementation(async (key: string) => {
      if (key === `sim:active:${mockDriverId}`) return mockBookingId;
      if (key === `sim:route:${mockBookingId}`) return mockRoute;
      if (key === `sim:step:${mockBookingId}`) return 0;
      return null;
    });

    await service.advanceSimulation(mockDriverId);

    expect(mockBookingRepo.updateBookingStatus).toHaveBeenCalledWith(
      mockBookingId,
      "arrived",
    );
    expect(mockCache.del).toHaveBeenCalledWith(`sim:active:${mockDriverId}`);
  });

  it("should not set sim:active when startSimulation fails", async () => {
    mockMaps.getDirections.mockResolvedValue({
      status: "NOT_FOUND",
      routes: [],
    });
    mockAmbulanceRepo.getAmbulanceProviderLocation.mockResolvedValue({
      lat: -6.0,
      lng: 106.7,
    });

    await service.startSimulationForBooking(mockBooking, "driver_1");

    expect(mockCache.set).not.toHaveBeenCalledWith(
      "sim:active:driver_1",
      expect.any(String),
      expect.any(Number),
    );
  });

  it("should start simulation using driver location as origin", async () => {
    const mockDriverId = "driver_1";
    const bookingWithDriver: Booking = {
      ...mockBooking,
      driver_id: mockDriverId,
    };
    const driverLoc = { lat: -6.05, lng: 106.75 };

    mockCache.getDriverLocation.mockResolvedValue(driverLoc);
    mockMaps.getDirections.mockResolvedValue({
      status: "OK",
      routes: [
        {
          bounds: {},
          copyrights: "",
          legs: [],
          overview_polyline: { points: "a~l~Fjk_uO~clMmhwD" },
          summary: "",
          warnings: [],
          waypoint_order: [],
        },
      ],
    });

    await service.startSimulation(bookingWithDriver);

    expect(mockCache.getDriverLocation).toHaveBeenCalledWith(mockDriverId);
    expect(mockMaps.getDirections).toHaveBeenCalledWith(
      "-6.05,106.75",
      "-6.1,106.8",
    );
  });

  it("should clean up simulation keys when booking is null", async () => {
    const mockDriverId = "driver_1";
    mockCache.get.mockImplementation(async (key: string) => {
      if (key === `sim:active:${mockDriverId}`) return "booking_1";
      return null;
    });
    mockBookingRepo.getBooking.mockResolvedValue(null);
    mockCache.del.mockResolvedValue(undefined);

    await service.advanceSimulation(mockDriverId);

    expect(mockCache.del).toHaveBeenCalledWith("sim:active:driver_1");
    expect(mockCache.del).toHaveBeenCalledWith("sim:route:booking_1");
    expect(mockCache.del).toHaveBeenCalledWith("sim:step:booking_1");
    expect(mockRealtime.broadcastTripLocation).not.toHaveBeenCalled();
  });
});
