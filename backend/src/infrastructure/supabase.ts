import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IPersistenceRepository } from "../repositories/db";
import { Booking, BookingData } from "../types";
import { fetchWithTimeout } from "./util";

export class SupabaseRepository implements IPersistenceRepository {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      global: {
        fetch: (url, options) => fetchWithTimeout(url as string, options),
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
      console.error("Supabase createBooking error:", error);
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }
    return booking as Booking;
  }

  async getBooking(id: string): Promise<Booking | null> {
    const { data: booking, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      console.error("Supabase getBooking error:", error);
      return null;
    }
    return booking as Booking;
  }

  async updateBookingStatus(id: string, status: string): Promise<void> {
    const { error } = await this.client
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("Supabase updateBookingStatus error:", error);
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }
  }
}
