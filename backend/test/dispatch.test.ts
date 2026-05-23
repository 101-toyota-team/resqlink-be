import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { DispatchService } from "../src/services/dispatch";
import { ICacheRepository } from "../src/repositories/cache";
import { IPersistenceRepository } from "../src/repositories/db";
import { IGeoService } from "../src/services/geo";
import { IDistanceService } from "../src/services/distance";
import { IMapsRepository } from "../src/repositories/maps";
import { DriverLocation, Booking } from "../src/types";

describe("DispatchService", () => {
  let mockCache: Mocked<ICacheRepository>;
  let mockDb: Mocked<IPersistenceRepository>;
  let mockGeo: Mocked<IGeoService>;
  let mockDistance: Mocked<IDistanceService>;
  let mockMaps: Mocked<IMapsRepository>;
  let service: DispatchService;

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
      incr: vi.fn(),
      del: vi.fn(),
    } as Mocked<ICacheRepository>;
    mockDb = {
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      updateBookingStatus: vi.fn(),
      assignAmbulance: vi.fn(),
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      broadcastTripLocation: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
      getConfirmedBookings: vi.fn(),
      getUserBookings: vi.fn(),
      searchProviders: vi.fn(),
      findProvidersByH3Indexes: vi.fn(),
      searchHospitals: vi.fn(),
      findHospitalsByH3Indexes: vi.fn(),
    } as Mocked<IPersistenceRepository>;
    mockGeo = {
      parseLatLng: vi.fn(),
      latLngToCell: vi.fn(),
      getNeighbors: vi.fn(),
      cellToLatLng: vi.fn(),
      haversineDistance: vi.fn(),
    } as Mocked<IGeoService>;
    mockDistance = {
      getEnrichedDrivers: vi.fn(),
    } as Mocked<IDistanceService>;
    mockMaps = {
      getDirections: vi.fn(),
      getDistanceMatrix: vi.fn(),
      searchPlaces: vi.fn(),
    } as Mocked<IMapsRepository>;
    service = new DispatchService(
      mockCache,
      mockDb,
      mockGeo,
      mockDistance,
      mockMaps,
    );
  });

  it("should find nearby drivers from DB and call distance service for enrichment", async () => {
    // 1. Setup mocks
    mockGeo.getNeighbors.mockReturnValue(["878c84c525fff"]);
    mockDb.findAvailableAmbulances.mockResolvedValue([
      { id: "driver_1", lat: -6.1, lng: 106.8 },
    ]);
    mockDistance.getEnrichedDrivers.mockResolvedValue([
      {
        id: "driver_1",
        lat: -6.1,
        lng: 106.8,
        eta: "5 mins",
        distance: "1.2 km",
      } as DriverLocation & { id: string; eta: string; distance: string },
    ]);

    // 2. Execute
    const results = await service.findNearbyDrivers(
      "878c84c525fff",
      1,
      "-6.12,106.85",
    );

    // 3. Assert
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "driver_1",
      eta: "5 mins",
    });

    expect(mockGeo.getNeighbors).toHaveBeenCalledWith("878c84c525fff", 1);
    expect(mockDb.findAvailableAmbulances).toHaveBeenCalledWith([
      "878c84c525fff",
    ]);
    expect(mockDistance.getEnrichedDrivers).toHaveBeenCalled();
  });

  it("should return raw drivers from DB without enrichment if pickupLocation is missing", async () => {
    mockGeo.getNeighbors.mockReturnValue(["878c84c525fff"]);
    mockDb.findAvailableAmbulances.mockResolvedValue([
      { id: "driver_1", lat: -6.1, lng: 106.8 },
    ]);
    mockDistance.getEnrichedDrivers.mockResolvedValue([
      { id: "driver_1", eta: "10 mins" } as DriverDetails,
    ]);

    // 2. Call service
    const results = await service.findNearbyDrivers("878c84c525fff", 1);

    // 3. Verify results
    expect(mockGeo.getNeighbors).toHaveBeenCalledWith("878c84c525fff", 1);
    expect(mockDb.findAvailableAmbulances).toHaveBeenCalledWith([
      "878c84c525fff",
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: "driver_1", lat: -6.1, lng: 106.8 });
    expect(mockDistance.getEnrichedDrivers).not.toHaveBeenCalled();
  });

  it("should return empty array and skip distance enrichment if no drivers found in DB", async () => {
    mockGeo.getNeighbors.mockReturnValue(["878c84c525fff"]);
    mockDb.findAvailableAmbulances.mockResolvedValue([]);

    const results = await service.findNearbyDrivers(
      "878c84c525fff",
      1,
      "-6.12,106.85",
    );

    expect(results).toHaveLength(0);
    expect(mockDistance.getEnrichedDrivers).not.toHaveBeenCalled();
  });

  describe("Simulation", () => {
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

    it("should start simulation by fetching directions and storing in cache", async () => {
      mockDb.getAmbulanceProviderLocation.mockResolvedValue({
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

      expect(mockDb.getAmbulanceProviderLocation).toHaveBeenCalledWith("amb_1");
      expect(mockMaps.getDirections).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        "sim:route:booking_1",
        expect.any(Array),
        3600,
      );
      expect(mockCache.set).toHaveBeenCalledWith("sim:step:booking_1", 0, 3600);
    });

    it("should not start simulation if directions are empty", async () => {
      mockDb.getAmbulanceProviderLocation.mockResolvedValue({
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
        return null; // Missing route/step
      });

      await service.advanceSimulation(mockDriverId);

      expect(mockDb.broadcastTripLocation).not.toHaveBeenCalled();
      expect(mockDb.updateBookingStatus).not.toHaveBeenCalled();
    });

    it("should advance simulation and broadcast location", async () => {
      const mockDriverId = "driver_1";
      const mockBookingId = "booking_1";
      const mockRoute = [
        { lat: -6.05, lng: 106.75 },
        { lat: -6.1, lng: 106.8 },
      ];
      mockDb.getBooking.mockResolvedValue({
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

      expect(mockDb.broadcastTripLocation).toHaveBeenCalledWith(mockBookingId, {
        lat: -6.05,
        lng: 106.75,
      });
      expect(mockCache.set).toHaveBeenCalledWith("sim:step:booking_1", 1, 3600);
    });

    it("should update status to arrived when simulation reaches end", async () => {
      const mockDriverId = "driver_1";
      const mockBookingId = "booking_1";
      const mockRoute = [{ lat: -6.1, lng: 106.8 }];
      mockDb.getBooking.mockResolvedValue({
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

      expect(mockDb.updateBookingStatus).toHaveBeenCalledWith(
        mockBookingId,
        "arrived",
      );
    });

    it("should not set sim:active when startSimulation fails", async () => {
      mockMaps.getDirections.mockResolvedValue({
        status: "NOT_FOUND",
        routes: [],
      });
      mockDb.getAmbulanceProviderLocation.mockResolvedValue({
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

    it("should clean up simulation keys when booking is null", async () => {
      const mockDriverId = "driver_1";
      mockCache.get.mockImplementation(async (key: string) => {
        if (key === `sim:active:${mockDriverId}`) return "booking_1";
        return null;
      });
      mockDb.getBooking.mockResolvedValue(null);
      mockCache.del.mockResolvedValue(undefined);

      await service.advanceSimulation(mockDriverId);

      expect(mockCache.del).toHaveBeenCalledWith("sim:active:driver_1");
      expect(mockCache.del).toHaveBeenCalledWith("sim:route:booking_1");
      expect(mockCache.del).toHaveBeenCalledWith("sim:step:booking_1");
      expect(mockDb.broadcastTripLocation).not.toHaveBeenCalled();
    });
  });

  describe("updateDriverStatus", () => {
    it("should advance simulation when pinged", async () => {
      const mockDriverId = "driver-123";

      mockCache.get.mockImplementation(async (key: string) => {
        if (key === `sim:active:${mockDriverId}`) return "booking_1";
        return null;
      });

      await service.updateDriverStatus(mockDriverId, { lat: 0, lng: 0 }, "h3");

      expect(mockCache.get).toHaveBeenCalledWith(`sim:active:${mockDriverId}`);
    });
  });
});
