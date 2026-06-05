import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { DriverService } from "../src/services/driver";
import { IDriverRepository } from "../src/repositories/driver";
import { IDriverLocationRepository } from "../src/repositories/driver-location";
import { IBookingRepository } from "../src/repositories/booking";
import { IRealtimeBroadcaster } from "../src/repositories/realtime";
import { Booking } from "../src/types";

describe("DriverService", () => {
  let mockDriverRepo: Mocked<IDriverRepository>;
  let mockLocationRepo: Mocked<IDriverLocationRepository>;
  let mockBookingRepo: Mocked<IBookingRepository>;
  let mockRealtime: Mocked<IRealtimeBroadcaster>;
  let service: DriverService;

  beforeEach(() => {
    mockDriverRepo = {
      getDriver: vi.fn(),
      updateAvailability: vi.fn(),
    } as Mocked<IDriverRepository>;

    mockLocationRepo = {
      updateLatest: vi.fn(),
      getLatest: vi.fn(),
      getLatestBatch: vi.fn(),
      flushBatch: vi.fn(),
      getTripHistory: vi.fn(),
    } as Mocked<IDriverLocationRepository>;

    mockBookingRepo = {
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      updateBookingStatus: vi.fn(),
      assignAmbulance: vi.fn(),
      getUserBookings: vi.fn(),
      getConfirmedBookings: vi.fn(),
      getBookingsByProvider: vi.fn(),
      getDriverAssignments: vi.fn(),
    } as Mocked<IBookingRepository>;

    mockRealtime = {
      broadcastTripLocation: vi.fn().mockResolvedValue("ok"),
      broadcastNewBooking: vi.fn().mockResolvedValue("ok"),
    } as Mocked<IRealtimeBroadcaster>;

    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };
    service = new DriverService(
      mockDriverRepo,
      mockLocationRepo,
      mockBookingRepo,
      mockRealtime,
      mockLogger,
    );
  });

  describe("updateLocation", () => {
    it("should save location to Redis and broadcast when booking_id present", async () => {
      await service.updateLocation("driver_1", {
        lat: -6.2,
        lng: 106.8,
        heading: 90,
        speed: 30,
        booking_id: "booking_1",
      });

      expect(mockLocationRepo.updateLatest).toHaveBeenCalledWith(
        "driver_1",
        expect.objectContaining({
          lat: -6.2,
          lng: 106.8,
          heading: 90,
          speed: 30,
          booking_id: "booking_1",
        }),
      );

      expect(mockRealtime.broadcastTripLocation).toHaveBeenCalledWith(
        "booking_1",
        expect.objectContaining({
          lat: -6.2,
          lng: 106.8,
        }),
      );
    });

    it("should save location but not broadcast when no booking_id", async () => {
      await service.updateLocation("driver_1", {
        lat: -6.2,
        lng: 106.8,
      });

      expect(mockLocationRepo.updateLatest).toHaveBeenCalled();
      expect(mockRealtime.broadcastTripLocation).not.toHaveBeenCalled();
    });
  });

  describe("getAssignments", () => {
    it("should return bookings from repository", async () => {
      const mockBookings = [{ id: "booking_1" } as Booking];
      mockBookingRepo.getDriverAssignments.mockResolvedValue(mockBookings);

      const result = await service.getAssignments("driver_1");

      expect(mockBookingRepo.getDriverAssignments).toHaveBeenCalledWith(
        "driver_1",
      );
      expect(result).toEqual(mockBookings);
    });
  });

  describe("setOnlineStatus", () => {
    it("should update driver availability", async () => {
      await service.setOnlineStatus("driver_1", true);

      expect(mockDriverRepo.updateAvailability).toHaveBeenCalledWith(
        "driver_1",
        true,
      );
    });

    it("should set offline status", async () => {
      await service.setOnlineStatus("driver_1", false);

      expect(mockDriverRepo.updateAvailability).toHaveBeenCalledWith(
        "driver_1",
        false,
      );
    });
  });
});
