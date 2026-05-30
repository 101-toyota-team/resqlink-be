import { IBookingRepository } from "../repositories/booking";
import { IAmbulanceRepository } from "../repositories/ambulance";
import { IRealtimeBroadcaster } from "../repositories/realtime";
import { ISimulationService } from "./simulation";
import { Booking, BookingData, JwtPayload } from "../types";
import type { BookingStatus } from "../utils/constants";
import { ERROR_MESSAGES } from "../utils/constants";
import { canAccessBooking, isDriverRole, isProviderRole } from "../utils/auth";
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
}

export class BookingService implements IBookingService {
  constructor(
    private bookingRepo: IBookingRepository,
    private ambulanceRepo: IAmbulanceRepository,
    private realtime: IRealtimeBroadcaster,
    private simulation: ISimulationService,
  ) {}

  async createBooking(data: BookingData, userId: string): Promise<Booking> {
    const bookingData = { ...data, user_id: userId };
    const booking = await this.bookingRepo.createBooking(bookingData);

    if (booking.status === "draft" && booking.provider_id) {
      await this.realtime
        .broadcastNewBooking(booking.provider_id, booking)
        .catch((err) => {
          console.error("Failed to broadcast new booking to provider:", err);
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
      throw new BookingStateError("Booking is not in draft status");
    }

    const ambulance = await this.ambulanceRepo.getAmbulance(ambulanceId);
    if (!ambulance) {
      throw new NotFoundError("Ambulance not found");
    }

    if (booking.provider_id) {
      if (ambulance.provider_id !== booking.provider_id) {
        throw new ForbiddenError(
          "Ambulance does not belong to the selected provider",
        );
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
      !isDriverRole(payload) &&
      !isProviderRole(payload)
    ) {
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    }

    const allowedTransitions = VALID_TRANSITIONS[booking.status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new BookingStateError(
        `Cannot transition from ${booking.status} to ${newStatus}`,
      );
    }

    if (newStatus === "en_route") {
      const started = await this.simulation.startSimulationForBooking(
        booking,
        payload.sub,
      );
      if (!started) {
        throw new Error("Failed to start route simulation");
      }
    }

    await this.bookingRepo.updateBookingStatus(id, newStatus);
    const updated = await this.bookingRepo.getBooking(id);
    if (!updated) throw new Error("Booking not found after update");
    return updated;
  }
}
