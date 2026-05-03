import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IPersistenceRepository } from "../repositories/db";
import { Booking, BookingData } from "../types";
import { fetchWithTimeout } from "./util";
import logger from "../utils/logger";

// Type guard to validate Booking object structure
function isValidBooking(data: unknown): data is Booking {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).id === "string" &&
    typeof (data as Record<string, unknown>).user_id === "string"
  );
}

// Type guard to check if URL is a string or Request
function isStringUrl(url: unknown): url is string {
  return typeof url === "string";
}

export class SupabaseRepository implements IPersistenceRepository {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      global: {
        fetch: (url, options) => {
          if (!isStringUrl(url)) {
            throw new Error("Fetch URL must be a string");
          }
          return fetchWithTimeout(url, options);
        },
      },
    });
  }

  async createBooking(data: BookingData): Promise<Booking> {
    const { data: booking, error } = await this.client
      .from("bookings")
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error("Supabase createBooking error: %O", error);
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }
    
    if (!isValidBooking(booking)) {
      logger.error("Invalid booking response from Supabase: %O", booking);
      throw new Error("Invalid booking data received from database");
    }
    
    return booking;
  }

  async getBooking(id: string): Promise<Booking | null> {
    const { data: booking, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      logger.error("Supabase getBooking error: %O", error);
      return null;
    }
    
    if (!isValidBooking(booking)) {
      logger.error("Invalid booking response from Supabase: %O", booking);
      return null;
    }
    
    return booking;
  }

  async updateBookingStatus(id: string, status: string): Promise<void> {
    const { error } = await this.client
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (error) {
      logger.error("Supabase updateBookingStatus error: %O", error);
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }
  }
}
