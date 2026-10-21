import { IBookingRepository } from "../repositories/booking";
import { IAmbulanceRepository } from "../repositories/ambulance";
import { IDriverRepository } from "../repositories/driver";
import { IRealtimeBroadcaster } from "../repositories/realtime";
import { Booking, BookingData, JwtPayload, RouteGeometry } from "../types";
import type { BookingStatus } from "../utils/constants";
import { BOOKING_FEES, ERROR_MESSAGES } from "../utils/constants";
import {
  canAccessBooking,
  isAdminRole,
  isDriverRole,
  isProviderRole,
} from "../utils/auth";
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
    waitUntil?: (promise: Promise<unknown>) => void,
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
    waitUntil?: (promise: Promise<unknown>) => void,
  ): Promise<Booking>;
  updateStatus(
    id: string,
    status: BookingStatus,
    payload: JwtPayload,
    waitUntil?: (promise: Promise<unknown>) => void,
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
    private driverRepo: IDriverRepository,
    private realtime: IRealtimeBroadcaster,
    private distanceService: IDistanceService,
    private logger: ILogger,
  ) {}

  async createBooking(
    data: BookingData,
    userId: string,
    waitUntil?: (promise: Promise<unknown>) => void,
  ): Promise<Booking> {
    this.logger.debug("Booking created", {
      userId,
      bookingType: data.booking_type,
      pickupH3: data.pickup_h3,
    });
    const estimated_price = BOOKING_FEES[data.booking_type];
    const bookingData: BookingData = {
      ...data,
      user_id: userId,
      estimated_price,
    };

    if (data.ambulance_id) {
      const ambulance = await this.ambulanceRepo.getAmbulance(
        data.ambulance_id,
      );
      if (!ambulance) {
        throw new NotFoundError(ERROR_MESSAGES.AMBULANCE_NOT_FOUND);
      }
      bookingData.provider_id = ambulance.provider_id;
      bookingData.route_geometry = await this.buildRouteGeometry(
        (await this.ambulanceRepo.getAmbulanceProviderLocation(
          data.ambulance_id,
        )) ?? { lat: data.pickup_lat, lng: data.pickup_lng },
        { lat: data.pickup_lat, lng: data.pickup_lng },
        { lat: data.destination_lat, lng: data.destination_lng },
      );
    }

    const booking = await this.bookingRepo.createBooking(bookingData);

    if (booking.provider_id) {
      const broadcastPromise = this.realtime
        .broadcastNewBooking(booking.provider_id, booking)
        .catch((err) => {
          this.logger.error(err, "Failed to broadcast new booking");
        });

      if (waitUntil) {
        waitUntil(broadcastPromise);
      } else {
        await broadcastPromise;
      }
    }

    this.logger.info("Booking created", {
      bookingId: booking.id,
      status: booking.status,
    });
    return booking;
  }

  private async buildRouteGeometry(
    ambulanceOrigin: { lat: number; lng: number },
    pickup: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteGeometry> {
    const [leg1, leg2] = await Promise.all([
      this.distanceService.getRouteLeg(ambulanceOrigin, pickup),
      this.distanceService.getRouteLeg(pickup, destination),
    ]);

    return {
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
    waitUntil?: (promise: Promise<unknown>) => void,
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

    if (driverId) {
      const driver = await this.driverRepo.getDriver(driverId);
      if (!driver) {
        throw new NotFoundError(ERROR_MESSAGES.DRIVER_NOT_FOUND);
      }
      if (driver.provider_id !== ambulance.provider_id) {
        throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
      }
    }

    try {
      const providerLoc =
        await this.ambulanceRepo.getAmbulanceProviderLocation(ambulanceId);
      const ambulanceOrigin = providerLoc ?? {
        lat: booking.pickup_lat,
        lng: booking.pickup_lng,
      };

      this.logger.debug("Route calculation started", {
        bookingId: id,
        ambulanceOrigin,
        pickup: { lat: booking.pickup_lat, lng: booking.pickup_lng },
        destination: {
          lat: booking.destination_lat,
          lng: booking.destination_lng,
        },
      });

      const routeGeometry = await this.buildRouteGeometry(
        ambulanceOrigin,
        { lat: booking.pickup_lat, lng: booking.pickup_lng },
        { lat: booking.destination_lat, lng: booking.destination_lng },
      );

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

      const broadcastPromise = this.realtime
        .broadcastAmbulanceAssigned(id, result)
        .catch((err) => {
          this.logger.error(err, "Failed to broadcast ambulance assignment");
        });

      if (waitUntil) {
        waitUntil(broadcastPromise);
      } else {
        await broadcastPromise;
      }

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
    waitUntil?: (promise: Promise<unknown>) => void,
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

    const allowedTransitions = VALID_TRANSITIONS[booking.status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      this.logger.warn("Unauthorized status transition attempt", {
        bookingId: id,
        targetStatus: newStatus,
        userId: payload.sub,
      });
      throw new BookingStateError(ERROR_MESSAGES.INVALID_BOOKING_TRANSITION);
    }

    // Only the provider, an admin, or the assigned driver may advance the trip;
    // the patient can cancel but must not drive their own trip forward.
    if (
      newStatus !== "cancelled" &&
      !isProviderRole(payload) &&
      !isAdminRole(payload) &&
      !(isDriverRole(payload) && booking.driver_id === payload.sub)
    ) {
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    }

    if (newStatus === "en_route") {
      if (!booking.ambulance_id) {
        throw new BookingStateError(ERROR_MESSAGES.NO_ASSIGNED_AMBULANCE);
      }
    }

    await this.bookingRepo.updateBookingStatus(id, booking.status, newStatus);

    const updatedBooking = await this.bookingRepo.getBooking(id);
    if (!updatedBooking) {
      throw new NotFoundError(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    const broadcastPromise = this.realtime
      .broadcastStatusUpdated(id, updatedBooking)
      .catch((err) => {
        this.logger.error(err, "Failed to broadcast status update");
      });

    if (waitUntil) {
      waitUntil(broadcastPromise);
    } else {
      await broadcastPromise;
    }

    this.logger.info("Booking status transition", {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: newStatus,
      userId: payload.sub,
    });
    return updatedBooking;
  }
}
