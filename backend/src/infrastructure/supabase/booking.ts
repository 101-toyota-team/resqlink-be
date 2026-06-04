import { IBookingRepository } from "../../repositories/booking";
import { SupabaseClientBase } from "./client";
import { Booking, BookingData, RouteGeometry } from "../../types";
import type { BookingStatus } from "../../utils/constants";
import { BookingStateError } from "../../utils/errors";
import {
  DatabaseSchemaDriftError,
  ERROR_MESSAGES,
} from "../../utils/constants";
import { dbBookingSchema } from "../../schemas/db";
import type { ILogger } from "../../types";

export class BookingRepository
  extends SupabaseClientBase
  implements IBookingRepository
{
  constructor(url: string, key: string, logger: ILogger) {
    super(url, key, logger);
  }

  private parseBooking(data: unknown): Booking {
    const parsed = dbBookingSchema.parse(data);
    return {
      ...parsed,
      user_id: parsed.user_id || "",
    };
  }

  private parseBookingList(data: unknown): Booking[] {
    const parsed = dbBookingSchema.array().parse(data || []);
    return parsed.map((b) => ({
      ...b,
      user_id: b.user_id || "",
    }));
  }

  async createBooking(data: BookingData): Promise<Booking> {
    const insertData = {
      ...data,
      status: data.ambulance_id ? "confirmed" : "draft",
    };

    const { data: booking, error } = await this.client
      .from("bookings")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      this.logger.error(error, "Supabase createBooking error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return this.parseBooking(booking);
    } catch (err) {
      this.logger.error(err, "Database schema drift detected in createBooking");
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  async getBooking(id: string): Promise<Booking | null> {
    const { data: booking, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      this.logger.error(error, "Supabase getBooking error");
      return null;
    }

    try {
      return this.parseBooking(booking);
    } catch (err) {
      this.logger.error(err, "Database schema drift detected in getBooking");
      throw new DatabaseSchemaDriftError("Booking", err);
    }
  }

  async assignAmbulance(
    id: string,
    ambulanceId: string,
    providerId?: string,
    routeGeometry?: RouteGeometry,
    driverId?: string,
  ): Promise<Booking> {
    const updateData: Record<string, unknown> = {
      ambulance_id: ambulanceId,
      status: "confirmed",
    };
    if (providerId) {
      updateData.provider_id = providerId;
    }
    if (routeGeometry) {
      updateData.route_geometry = routeGeometry;
    }
    if (driverId) {
      updateData.driver_id = driverId;
    }

    const { data, error } = await this.client
      .from("bookings")
      .update(updateData)
      .eq("id", id)
      .eq("status", "draft")
      .select()
      .single<Booking>();

    if (error) {
      if (error.code === "PGRST116") {
        throw new BookingStateError("Booking is no longer in draft status");
      }
      this.logger.error(error, "Supabase assignAmbulance error");
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR, { cause: error });
    }

    try {
      return this.parseBooking(data);
    } catch (err) {
      this.logger.error(
        err,
        "Database schema drift detected in assignAmbulance",
      );
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  async updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
    const { error } = await this.client
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (error) {
      this.logger.error(error, "Supabase updateBookingStatus error");
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR, { cause: error });
    }
  }

  async getUserBookings(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    let query = this.client
      .from("bookings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
      }
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(error, "Supabase getUserBookings error");
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR, { cause: error });
    }

    try {
      return this.parseBookingList(data);
    } catch (err) {
      this.logger.error(
        err,
        "Database schema drift detected in getUserBookings",
      );
      throw new DatabaseSchemaDriftError("Booking", err);
    }
  }

  async getConfirmedBookings(
    providerId: string,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    let query = this.client
      .from("bookings")
      .select("*")
      .eq("status", "confirmed")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
      }
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(error, "Supabase getConfirmedBookings error");
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR, { cause: error });
    }

    try {
      return this.parseBookingList(data);
    } catch (err) {
      this.logger.error(
        err,
        "Database schema drift detected in getConfirmedBookings",
      );
      throw new DatabaseSchemaDriftError("Booking", err);
    }
  }

  async getBookingsByProvider(
    providerId: string,
    status?: BookingStatus,
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    let query = this.client
      .from("bookings")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
      }
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(error, "Supabase getBookingsByProvider error");
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR, { cause: error });
    }

    try {
      return this.parseBookingList(data);
    } catch (err) {
      this.logger.error(
        err,
        "Database schema drift detected in getBookingsByProvider",
      );
      throw new DatabaseSchemaDriftError("Booking", err);
    }
  }

  async getDriverAssignments(
    driverId: string,
    status?: BookingStatus[],
  ): Promise<Booking[]> {
    let query = this.client
      .from("bookings")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false });

    if (status && status.length > 0) {
      query = query.in("status", status);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(error, "Supabase getDriverAssignments error");
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR, { cause: error });
    }

    try {
      return this.parseBookingList(data);
    } catch (err) {
      this.logger.error(err, "Database schema drift in getDriverAssignments");
      throw new DatabaseSchemaDriftError("Booking", err);
    }
  }
}
