import { IBookingRepository } from "../repositories/booking";
import { IAmbulanceRepository } from "../repositories/ambulance";
import { IRealtimeBroadcaster } from "../repositories/realtime";
import { Booking, BookingData, JwtPayload, RouteGeometry } from "../types";
import type { BookingStatus } from "../utils/constants";
import { BOOKING_FEES, ERROR_MESSAGES } from "../utils/constants";
import { canAccessBooking, isAdminRole, isProviderRole } from "../utils/auth";
import type { ILogger } from "../types";

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["cancelled"],
  confirmed: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["to_hospital", "completed", "cancelled"],
  to_hospital: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

import {
  NotFoundError,
  ForbiddenError,
  BookingStateError,
} from "../utils/errors";
import { IDistanceService } from "./distance";

export interface IBookingService {
  createBooking(
    data: BookingData,
    userId: string,
    waitUntil?: (p: Promise<any>) => void,
  ): Promise<Booking>;
  getBooking(id: string, payload: JwtPayload): Promise<Booking>;
  getUserBookings(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]>;
  assignAmbulance(
    id: string,
    ambulanceId: string,
    payload: JwtPayload,
    driverId?: string,
    waitUntil?: (p: Promise<any>) => void,
  ): Promise<Booking>;
  updateStatus(
    id: string,
    status: BookingStatus,
    payload: JwtPayload,
    waitUntil?: (p: Promise<any>) => void,
  ): Promise<Booking>;
  getConfirmedBookings(
    providerId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]>;
  getBookingsByProvider(
    providerId: string,
    status?: BookingStatus,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]>;
}

export class BookingService implements IBookingService {
  constructor(
    private bookingRepo: IBookingRepository,
    private ambulanceRepo: IAmbulanceRepository,
    private realtime: IRealtimeBroadcaster,
    private distanceService: IDistanceService,
    private logger: ILogger,
  ) {}

  async createBooking(
    data: BookingData,
    userId: string,
    waitUntil?: (p: Promise<any>) => void,
  ): Promise<Booking> {
    this.logger.debug("Booking created", {
      userId,
      bookingType: data.booking_type,
      pickupH3: data.pickup_h3,
    });
    const estimated_price = BOOKING_FEES[data.booking_type];
    const bookingData = { ...data, user_id: userId, estimated_price };
    const booking = await this.bookingRepo.createBooking(bookingData);

    if (booking.status === "draft" && booking.provider_id) {
      const broadcastPromise = this.realtime
        .broadcastNewBooking(booking.provider_id, booking)
        .catch((err) => {
          this.logger.error(err, "Failed to broadcast new booking to provider");
        });

      if (waitUntil) {
        waitUntil(broadcastPromise);
      }
    }

    this.logger.info("Booking created", {
      bookingId: booking.id,
      status: booking.status,
    });
    return booking;
  }

  async getBooking(id: string, payload: JwtPayload): Promise<Booking> {
    const booking = await this.bookingRepo.getBooking(id);
    if (!booking) {
      this.logger.debug("Booking not found", {
        bookingId: id,
        userId: payload.sub,
      });
      throw new NotFoundError(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }
    if (
      !canAccessBooking(
        payload,
        booking.user_id,
        booking.provider_id || undefined,
        booking.driver_id || undefined,
      )
    ) {
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    }
    return booking;
  }

  async getUserBookings(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    return this.bookingRepo.getUserBookings(userId, limit, offset);
  }

  async getConfirmedBookings(
    providerId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    return this.bookingRepo.getConfirmedBookings(providerId, limit, offset);
  }

  async getBookingsByProvider(
    providerId: string,
    status?: BookingStatus,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    return this.bookingRepo.getBookingsByProvider(
      providerId,
      status,
      limit,
      offset,
    );
  }

  async assignAmbulance(
    id: string,
    ambulanceId: string,
    payload: JwtPayload,
    driverId?: string,
  ): Promise<Booking> {
    this.logger.debug("Assigning ambulance", {
      bookingId: id,
      ambulanceId,
      driverId,
    });
    const booking = await this.bookingRepo.getBooking(id);
    if (!booking) {
      throw new NotFoundError(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (
      !canAccessBooking(
        payload,
        booking.user_id,
        booking.provider_id || undefined,
        booking.driver_id || undefined,
      )
    ) {
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    }

    if (booking.status !== "draft") {
      throw new BookingStateError(ERROR_MESSAGES.BOOKING_NOT_DRAFT);
    }

    const ambulance = await this.ambulanceRepo.getAmbulance(ambulanceId);
    if (!ambulance) {
      throw new NotFoundError(ERROR_MESSAGES.AMBULANCE_NOT_FOUND);
    }

    if (booking.provider_id && ambulance.provider_id !== booking.provider_id) {
      throw new ForbiddenError(ERROR_MESSAGES.AMBULANCE_PROVIDER_MISMATCH);
    }

    try {
      const providerLoc =
        await this.ambulanceRepo.getAmbulanceProviderLocation(ambulanceId);
      const ambLat = providerLoc ? providerLoc.lat : booking.pickup_lat;
      const ambLng = providerLoc ? providerLoc.lng : booking.pickup_lng;

      this.logger.debug("Route calculation started", {
        bookingId: id,
        ambulanceOrigin: { lat: ambLat, lng: ambLng },
        pickup: { lat: booking.pickup_lat, lng: booking.pickup_lng },
        destination: {
          lat: booking.destination_lat,
          lng: booking.destination_lng,
        },
      });

      const leg1 = await this.distanceService.getRouteLeg(
        { lat: ambLat, lng: ambLng },
        { lat: booking.pickup_lat, lng: booking.pickup_lng },
      );

      const leg2 = await this.distanceService.getRouteLeg(
        { lat: booking.pickup_lat, lng: booking.pickup_lng },
        { lat: booking.destination_lat, lng: booking.destination_lng },
      );

      const routeGeometry: RouteGeometry = {
        total_distance_meters: leg1.distance + leg2.distance,
        total_duration_seconds: leg1.duration + leg2.duration,
        combined_viewport: {
          low: {
            lat: Math.min(leg1.viewport.low.lat, leg2.viewport.low.lat),
            lng: Math.min(leg1.viewport.low.lng, leg2.viewport.low.lng),
          },
          high: {
            lat: Math.max(leg1.viewport.high.lat, leg2.viewport.high.lat),
            lng: Math.max(leg1.viewport.high.lng, leg2.viewport.high.lng),
          },
        },
        legs: [
          { sequence: 1, encoded_polyline: leg1.encoded_polyline },
          { sequence: 2, encoded_polyline: leg2.encoded_polyline },
        ],
      };

      const finalProviderId = booking.provider_id
        ? undefined
        : ambulance.provider_id;
      const result = await this.bookingRepo.assignAmbulance(
        id,
        ambulanceId,
        finalProviderId,
        routeGeometry,
        driverId,
      );
      this.logger.info("Ambulance assigned", {
        bookingId: id,
        ambulanceId,
        driverId,
        status: "confirmed",
        totalDistance: routeGeometry.total_distance_meters,
      });
      return result;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.startsWith("ROUTING_FAILED")
      ) {
        throw new BookingStateError(
          "Cannot find a valid road route for this assignment.",
        );
      }
      throw error;
    }
  }

  async updateStatus(
    id: string,
    newStatus: BookingStatus,
    payload: JwtPayload,
  ): Promise<Booking> {
    const booking = await this.bookingRepo.getBooking(id);
    if (!booking) {
      throw new NotFoundError(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (
      !canAccessBooking(
        payload,
        booking.user_id,
        booking.provider_id || undefined,
        booking.driver_id || undefined,
      )
    ) {
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    }

    if (
      newStatus === "en_route" &&
      !isProviderRole(payload) &&
      !isAdminRole(payload)
    ) {
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    }

    const allowedTransitions = VALID_TRANSITIONS[booking.status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      this.logger.warn("Unauthorized status transition attempt", {
        bookingId: id,
        targetStatus: newStatus,
        userId: payload.sub,
      });
      throw new BookingStateError(ERROR_MESSAGES.INVALID_BOOKING_TRANSITION);
    }

    if (newStatus === "en_route") {
      if (!booking.ambulance_id) {
        throw new BookingStateError(ERROR_MESSAGES.NO_ASSIGNED_AMBULANCE);
      }
    }

    await this.bookingRepo.updateBookingStatus(id, newStatus);
    this.logger.info("Booking status transition", {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: newStatus,
      userId: payload.sub,
    });
    return { ...booking, status: newStatus };
  }
}
