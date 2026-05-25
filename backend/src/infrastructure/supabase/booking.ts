import { z } from "zod";
import { IBookingRepository } from "../../repositories/booking";
import { SupabaseClientBase } from "./client";
import { Booking, BookingData } from "../../types";
import type { BookingStatus } from "../../utils/constants";
import { DatabaseSchemaDriftError } from "../../utils/constants";
import { dbBookingSchema } from "../../schemas/db";
import logger from "../../utils/logger";

export class BookingRepository
  extends SupabaseClientBase
  implements IBookingRepository
{
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
      logger.error(error, "Supabase createBooking error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return this.parseBooking(booking);
    } catch (err) {
      logger.error(err, "Database schema drift detected in createBooking");
      throw new Error("Data integrity error occurred");
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
      logger.error(error, "Supabase getBooking error");
      return null;
    }

    try {
      return this.parseBooking(booking);
    } catch (err) {
      logger.error(err, "Database schema drift detected in getBooking");
      throw new DatabaseSchemaDriftError("Booking", err);
    }
  }

  async assignAmbulance(id: string, ambulanceId: string): Promise<Booking> {
    const { data, error } = await this.client
      .from("bookings")
      .update({ ambulance_id: ambulanceId, status: "confirmed" })
      .eq("id", id)
      .eq("status", "draft")
      .select()
      .single<Booking>();

    if (error) {
      if (error.code === "PGRST116") {
        throw new Error("Booking is no longer in draft status", {
          cause: error,
        });
      }
      logger.error(error, "Supabase assignAmbulance error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return this.parseBooking(data);
    } catch (err) {
      logger.error(err, "Database schema drift detected in assignAmbulance");
      throw new Error("Data integrity error occurred");
    }
  }

  async updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
    const { error } = await this.client
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (error) {
      logger.error(error, "Supabase updateBookingStatus error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
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
      logger.error(error, "Supabase getUserBookings error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return this.parseBookingList(data);
    } catch (err) {
      logger.error(err, "Database schema drift detected in getUserBookings");
      throw new DatabaseSchemaDriftError("Booking", err);
    }
  }

  async getConfirmedBookings(
    limit?: number,
    offset?: number,
  ): Promise<Booking[]> {
    let query = this.client
      .from("bookings")
      .select("*")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });

    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
      }
    }

    const { data, error } = await query;

    if (error) {
      logger.error(error, "Supabase getConfirmedBookings error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return this.parseBookingList(data);
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in getConfirmedBookings",
      );
      throw new DatabaseSchemaDriftError("Booking", err);
    }
  }
}
