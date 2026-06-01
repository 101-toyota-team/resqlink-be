import { IBookingRepository } from "../repositories/booking";
import { IAmbulanceRepository } from "../repositories/ambulance";
import { IRealtimeBroadcaster } from "../repositories/realtime";
import { ISimulationService } from "./simulation";
import { Booking, BookingData, JwtPayload } from "../types";
import type { BookingStatus } from "../utils/constants";
import { BOOKING_FEES, ERROR_MESSAGES } from "../utils/constants";
import { canAccessBooking, isAdminRole, isProviderRole } from "../utils/auth";
import logger from "../utils/logger";
import {
  NotFoundError,
  ForbiddenError,
  BookingStateError,
} from "../utils/errors";

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["cancelled"],
  confirmed: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["to_hospital", "completed", "cancelled"],
  to_hospital: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export interface IBookingService {
  createBooking(data: BookingData, userId: string): Promise<Booking>;
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
  ): Promise<Booking>;
  updateStatus(
    id: string,
    status: BookingStatus,
    payload: JwtPayload,
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
    private simulation: ISimulationService,
  ) {}

  async createBooking(data: BookingData, userId: string): Promise<Booking> {
    const estimated_price = BOOKING_FEES[data.booking_type];
    const bookingData = { ...data, user_id: userId, estimated_price };
    const booking = await this.bookingRepo.createBooking(bookingData);

    if (booking.status === "draft" && booking.provider_id) {
      await this.realtime
        .broadcastNewBooking(booking.provider_id, booking)
        .catch((err) => {
          logger.error(err, "Failed to broadcast new booking to provider");
        });
    }

    return booking;
  }

  async getBooking(id: string, payload: JwtPayload): Promise<Booking> {
    const booking = await this.bookingRepo.getBooking(id);
    if (!booking) {
      throw new NotFoundError(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }
    if (
      !canAccessBooking(
        payload,
        booking.user_id,
        booking.provider_id || undefined,
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

    if (booking.provider_id) {
      if (ambulance.provider_id !== booking.provider_id) {
        throw new ForbiddenError(ERROR_MESSAGES.AMBULANCE_PROVIDER_MISMATCH);
      }
      return this.bookingRepo.assignAmbulance(id, ambulanceId);
    }

    return this.bookingRepo.assignAmbulance(
      id,
      ambulanceId,
      ambulance.provider_id,
    );
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
      throw new BookingStateError(ERROR_MESSAGES.INVALID_BOOKING_TRANSITION);
    }

    if (newStatus === "en_route") {
      if (!booking.ambulance_id) {
        throw new BookingStateError(ERROR_MESSAGES.NO_ASSIGNED_AMBULANCE);
      }

      const started = await this.simulation.startSimulationForBooking(booking);
      if (!started) {
        throw new BookingStateError("Failed to start route simulation");
      }
    }

    if (newStatus === "cancelled") {
      await this.simulation.stopSimulation(id);
    }

    await this.bookingRepo.updateBookingStatus(id, newStatus);
    return { ...booking, status: newStatus };
  }
}
