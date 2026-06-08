import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { BookingService } from "../src/services/bookings";
import { IBookingRepository } from "../src/repositories/booking";
import { IAmbulanceRepository } from "../src/repositories/ambulance";
import { IRealtimeBroadcaster } from "../src/repositories/realtime";
import { IDistanceService } from "../src/services/distance";
import { Booking, ILogger } from "../src/types";
import {
  NotFoundError,
  ForbiddenError,
  BookingStateError,
} from "../src/utils/errors";
import { ERROR_MESSAGES } from "../src/utils/constants";

describe("BookingService", () => {
  let mockBookingRepo: Mocked<IBookingRepository>;
  let mockAmbulanceRepo: Mocked<IAmbulanceRepository>;
  let mockRealtime: Mocked<IRealtimeBroadcaster>;
  let mockDistanceService: Mocked<IDistanceService>;
  let service: BookingService;

  const mockUserPayload = {
    sub: "user_1",
    role: "user",
  };

  const mockProviderPayload = {
    sub: "provider_1",
    role: "provider",
    app_metadata: { role: "provider", provider_id: "provider_1" },
  };

  const mockDraftBooking: Booking = {
    id: "booking_1",
    ambulance_id: null,
    provider_id: "provider_1",
    booking_type: "medis",
    patient_condition: "Stable",
    pickup_address: "Jl. Sudirman No.1",
    pickup_lat: -6.2,
    pickup_lng: 106.8,
    pickup_h3: "878c106a4ffffff",
    destination_address: "RS Harapan",
    destination_lat: -6.3,
    destination_lng: 106.9,
    user_id: "user_1",
    driver_id: null,
    estimated_price: 50000,
    status: "draft",
    created_at: "2026-06-01T00:00:00.000Z",
  };

  const mockConfirmedBooking: Booking = {
    ...mockDraftBooking,
    ambulance_id: "amb_1",
    status: "confirmed",
  };

  beforeEach(() => {
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

    mockAmbulanceRepo = {
      getAmbulance: vi.fn(),
      findAvailableAmbulances: vi.fn(),
      getAmbulanceProviderLocation: vi.fn(),
    } as Mocked<IAmbulanceRepository>;

    mockRealtime = {
      broadcastTripLocation: vi.fn().mockResolvedValue(undefined),
      broadcastNewBooking: vi.fn().mockResolvedValue(undefined),
      broadcastAmbulanceAssigned: vi.fn().mockResolvedValue(undefined),
      broadcastStatusUpdated: vi.fn().mockResolvedValue(undefined),
    } as Mocked<IRealtimeBroadcaster>;

    mockDistanceService = {
      getEnrichedDrivers: vi.fn(),
      getRouteLeg: vi.fn().mockResolvedValue({
        distance: 5000,
        duration: 600,
        encoded_polyline: "mock_polyline",
        viewport: { low: { lat: 0, lng: 0 }, high: { lat: 1, lng: 1 } },
      }),
    } as Mocked<IDistanceService>;

    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as ILogger;

    service = new BookingService(
      mockBookingRepo,
      mockAmbulanceRepo,
      mockRealtime,
      mockDistanceService,
      mockLogger,
    );
  });

  describe("createBooking", () => {
    it("should create a booking with estimated price and return it", async () => {
      const mockBooking = { ...mockDraftBooking };
      mockBookingRepo.createBooking.mockResolvedValue(mockBooking);

      const result = await service.createBooking(
        {
          ambulance_id: null,
          provider_id: "provider_1",
          booking_type: "medis",
          patient_condition: "Stable",
          pickup_address: "Jl. Sudirman No.1",
          pickup_lat: -6.2,
          pickup_lng: 106.8,
          pickup_h3: "878c106a4ffffff",
          destination_address: "RS Harapan",
          destination_lat: -6.3,
          destination_lng: 106.9,
        },
        "user_1",
      );

      expect(mockBookingRepo.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_type: "medis",
          user_id: "user_1",
          estimated_price: 50000,
        }),
      );
      expect(result).toEqual(mockBooking);
    });

    it("should broadcast new booking to provider when draft with provider_id", async () => {
      const mockBooking = { ...mockDraftBooking };
      mockBookingRepo.createBooking.mockResolvedValue(mockBooking);
      mockRealtime.broadcastNewBooking.mockResolvedValue(undefined);

      await service.createBooking(
        {
          provider_id: "provider_1",
          booking_type: "medis",
          patient_condition: "Stable",
          pickup_address: "Jl. Sudirman No.1",
          pickup_lat: -6.2,
          pickup_lng: 106.8,
          pickup_h3: "878c106a4ffffff",
          destination_address: "RS Harapan",
          destination_lat: -6.3,
          destination_lng: 106.9,
        },
        "user_1",
      );

      expect(mockRealtime.broadcastNewBooking).toHaveBeenCalledWith(
        "provider_1",
        expect.objectContaining({ id: "booking_1" }),
      );
    });

    it("should not broadcast when provider_id is null", async () => {
      const bookingNoProvider = { ...mockDraftBooking, provider_id: null };
      mockBookingRepo.createBooking.mockResolvedValue(bookingNoProvider);

      await service.createBooking(
        {
          booking_type: "medis",
          patient_condition: "Stable",
          pickup_address: "Jl. Sudirman No.1",
          pickup_lat: -6.2,
          pickup_lng: 106.8,
          pickup_h3: "878c106a4ffffff",
          destination_address: "RS Harapan",
          destination_lat: -6.3,
          destination_lng: 106.9,
        },
        "user_1",
      );

      expect(mockRealtime.broadcastNewBooking).not.toHaveBeenCalled();
    });

    it("should not throw when broadcast fails", async () => {
      mockBookingRepo.createBooking.mockResolvedValue(mockDraftBooking);
      mockRealtime.broadcastNewBooking.mockRejectedValue(
        new Error("Broadcast failed"),
      );

      const result = await service.createBooking(
        {
          provider_id: "provider_1",
          booking_type: "medis",
          patient_condition: "Stable",
          pickup_address: "Jl. Sudirman No.1",
          pickup_lat: -6.2,
          pickup_lng: 106.8,
          pickup_h3: "878c106a4ffffff",
          destination_address: "RS Harapan",
          destination_lat: -6.3,
          destination_lng: 106.9,
        },
        "user_1",
      );

      expect(result).toEqual(mockDraftBooking);
    });
  });

  describe("getBooking", () => {
    it("should return booking when authorized", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockDraftBooking);

      const result = await service.getBooking("booking_1", mockUserPayload);

      expect(result).toEqual(mockDraftBooking);
    });

    it("should throw NotFoundError when booking not found", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(null);

      await expect(
        service.getBooking("non_existent", mockUserPayload),
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.getBooking("non_existent", mockUserPayload),
      ).rejects.toThrow(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    });

    it("should throw ForbiddenError when unauthorized", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockDraftBooking);
      const otherUserPayload = { sub: "user_2", role: "user" };

      await expect(
        service.getBooking("booking_1", otherUserPayload),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        service.getBooking("booking_1", otherUserPayload),
      ).rejects.toThrow(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    });
  });

  describe("getUserBookings", () => {
    it("should delegate to bookingRepo.getUserBookings", async () => {
      const mockBookings = [mockDraftBooking];
      mockBookingRepo.getUserBookings.mockResolvedValue(mockBookings);

      const result = await service.getUserBookings("user_1", 10, 0);

      expect(mockBookingRepo.getUserBookings).toHaveBeenCalledWith(
        "user_1",
        10,
        0,
      );
      expect(result).toEqual(mockBookings);
    });
  });

  describe("getConfirmedBookings", () => {
    it("should delegate to bookingRepo.getConfirmedBookings", async () => {
      const mockBookings = [mockConfirmedBooking];
      mockBookingRepo.getConfirmedBookings.mockResolvedValue(mockBookings);

      const result = await service.getConfirmedBookings("provider_1", 10, 0);

      expect(mockBookingRepo.getConfirmedBookings).toHaveBeenCalledWith(
        "provider_1",
        10,
        0,
      );
      expect(result).toEqual(mockBookings);
    });
  });

  describe("getBookingsByProvider", () => {
    it("should delegate to bookingRepo.getBookingsByProvider", async () => {
      const mockBookings = [mockDraftBooking];
      mockBookingRepo.getBookingsByProvider.mockResolvedValue(mockBookings);

      const result = await service.getBookingsByProvider(
        "provider_1",
        "draft",
        10,
        0,
      );

      expect(mockBookingRepo.getBookingsByProvider).toHaveBeenCalledWith(
        "provider_1",
        "draft",
        10,
        0,
      );
      expect(result).toEqual(mockBookings);
    });
  });

  describe("assignAmbulance", () => {
    it("should throw NotFoundError when booking not found", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(null);

      await expect(
        service.assignAmbulance(
          "booking_1",
          "amb_1",
          mockProviderPayload,
          undefined,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when unauthorized", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockDraftBooking);
      const wrongProvider = {
        sub: "provider_2",
        role: "provider",
        app_metadata: { role: "provider", provider_id: "provider_2" },
      };

      await expect(
        service.assignAmbulance("booking_1", "amb_1", wrongProvider),
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw BookingStateError when booking is not draft", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockConfirmedBooking);

      await expect(
        service.assignAmbulance(
          "booking_1",
          "amb_1",
          mockProviderPayload,
          undefined,
        ),
      ).rejects.toThrow(BookingStateError);
      await expect(
        service.assignAmbulance(
          "booking_1",
          "amb_1",
          mockProviderPayload,
          undefined,
        ),
      ).rejects.toThrow(ERROR_MESSAGES.BOOKING_NOT_DRAFT);
    });

    it("should throw NotFoundError when ambulance not found", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockDraftBooking);
      mockAmbulanceRepo.getAmbulance.mockResolvedValue(null);

      await expect(
        service.assignAmbulance(
          "booking_1",
          "amb_1",
          mockProviderPayload,
          undefined,
        ),
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.assignAmbulance(
          "booking_1",
          "amb_1",
          mockProviderPayload,
          undefined,
        ),
      ).rejects.toThrow(ERROR_MESSAGES.AMBULANCE_NOT_FOUND);
    });

    it("should throw ForbiddenError when ambulance provider does not match booking provider", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockDraftBooking);
      mockAmbulanceRepo.getAmbulance.mockResolvedValue({
        id: "amb_1",
        provider_id: "other_provider",
      });

      await expect(
        service.assignAmbulance(
          "booking_1",
          "amb_1",
          mockProviderPayload,
          undefined,
        ),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        service.assignAmbulance(
          "booking_1",
          "amb_1",
          mockProviderPayload,
          undefined,
        ),
      ).rejects.toThrow(ERROR_MESSAGES.AMBULANCE_PROVIDER_MISMATCH);
    });

    it("should assign ambulance when booking has provider_id and ambulance matches", async () => {
      const assignedBooking = {
        ...mockDraftBooking,
        ambulance_id: "amb_1",
        status: "confirmed" as const,
      };
      mockBookingRepo.getBooking.mockResolvedValue(mockDraftBooking);
      mockAmbulanceRepo.getAmbulance.mockResolvedValue({
        id: "amb_1",
        provider_id: "provider_1",
      });
      mockBookingRepo.assignAmbulance.mockResolvedValue(assignedBooking);

      const result = await service.assignAmbulance(
        "booking_1",
        "amb_1",
        mockProviderPayload,
      );

      expect(mockBookingRepo.assignAmbulance).toHaveBeenCalledWith(
        "booking_1",
        "amb_1",
        undefined,
        expect.anything(),
        undefined,
      );
      expect(result).toEqual(assignedBooking);
    });

    it("should assign ambulance with provider_id when booking has no provider_id", async () => {
      const bookingNoProvider = { ...mockDraftBooking, provider_id: null };
      const assignedBooking = {
        ...bookingNoProvider,
        ambulance_id: "amb_1",
        status: "confirmed" as const,
      };
      mockBookingRepo.getBooking.mockResolvedValue(bookingNoProvider);
      mockAmbulanceRepo.getAmbulance.mockResolvedValue({
        id: "amb_1",
        provider_id: "provider_1",
      });
      mockBookingRepo.assignAmbulance.mockResolvedValue(assignedBooking);

      // Admin user can access bookings without provider_id
      const adminPayload = {
        sub: "admin_1",
        role: "admin",
        app_metadata: { role: "admin" },
      };

      const result = await service.assignAmbulance(
        "booking_1",
        "amb_1",
        adminPayload,
      );

      expect(mockBookingRepo.assignAmbulance).toHaveBeenCalledWith(
        "booking_1",
        "amb_1",
        "provider_1",
        expect.anything(),
        undefined,
      );
      expect(result).toEqual(assignedBooking);
    });
  });

  describe("updateStatus", () => {
    it("should throw NotFoundError when booking not found", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(null);

      await expect(
        service.updateStatus("booking_1", "confirmed", mockUserPayload),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when unauthorized", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockConfirmedBooking);
      const otherUser = { sub: "user_2", role: "user" };

      await expect(
        service.updateStatus("booking_1", "en_route", otherUser),
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw ForbiddenError when non-driver/provider sets en_route", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockConfirmedBooking);

      await expect(
        service.updateStatus("booking_1", "en_route", mockUserPayload),
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw BookingStateError for invalid transition", async () => {
      mockBookingRepo.getBooking.mockResolvedValue(mockConfirmedBooking);

      await expect(
        service.updateStatus("booking_1", "draft", mockProviderPayload),
      ).rejects.toThrow(BookingStateError);
      await expect(
        service.updateStatus("booking_1", "draft", mockProviderPayload),
      ).rejects.toThrow(ERROR_MESSAGES.INVALID_BOOKING_TRANSITION);
    });

    it("should throw BookingStateError when no driver assigned for en_route", async () => {
      const bookingNoDriver = {
        ...mockConfirmedBooking,
        ambulance_id: null,
      };
      mockBookingRepo.getBooking.mockResolvedValue(bookingNoDriver);

      await expect(
        service.updateStatus("booking_1", "en_route", mockProviderPayload),
      ).rejects.toThrow(ERROR_MESSAGES.NO_ASSIGNED_AMBULANCE);
    });
  });
});
