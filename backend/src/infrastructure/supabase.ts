import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IPersistenceRepository } from "../repositories/db";
import {
  Booking,
  BookingData,
  DriverDetails,
  DriverLocation,
  Provider,
  Hospital,
  HospitalDetails,
} from "../types";
import { fetchWithTimeout } from "./util";
import logger from "../utils/logger";

function isValidBooking(data: unknown): data is Booking {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).id === "string" &&
    typeof (data as Record<string, unknown>).user_id === "string"
  );
}

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
      if (error.code === "PGRST116") return null;
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

  async findAvailableAmbulances(h3Indexes: string[]): Promise<DriverDetails[]> {
    const { data, error } = await this.client
      .from("ambulances")
      .select(
        `
        id,
        providers!inner (
          latitude,
          longitude
        )
      `,
      )
      .eq("status", "available")
      .in("providers.h3_index", h3Indexes);

    if (error) {
      logger.error("Supabase findAvailableAmbulances error: %O", error);
      return [];
    }

    return (data as unknown as AmbulanceDiscoveryResult[]).map((item) => ({
      id: item.id,
      lat: item.providers.latitude,
      lng: item.providers.longitude,
    }));
  }

  async broadcastTripLocation(
    bookingId: string,
    location: DriverLocation,
  ): Promise<void> {
    const channel = this.client.channel(`trip:${bookingId}`);
    await channel.send({
      type: "broadcast",
      event: "location_update",
      payload: location,
    });
    await this.client.removeChannel(channel);
  }

  async getAmbulanceProviderLocation(
    ambulanceId: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const { data, error } = await this.client
      .from("ambulances")
      .select(
        `
        providers (
          latitude,
          longitude
        )
      `,
      )
      .eq("id", ambulanceId)
      .single();

    if (error || !data) {
      logger.error("Supabase getAmbulanceProviderLocation error: %O", error);
      return null;
    }

    type AmbulanceData = {
      providers:
        | {
            latitude: number;
            longitude: number;
          }[]
        | null;
    };

    const providerData = (data as AmbulanceData).providers;
    if (!providerData || providerData.length === 0) return null;
    const provider = providerData[0];
    if (!provider) return null;

    return {
      lat: provider.latitude,
      lng: provider.longitude,
    };
  }

  async getConfirmedBookings(): Promise<Booking[]> {
    const { data, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Supabase getConfirmedBookings error: %O", error);
      return [];
    }

    return (data || []) as Booking[];
  }

  async searchProviders(query: string): Promise<Provider[]> {
    const { data, error } = await this.client.rpc(
      "search_providers_optimized",
      {
        search_term: query,
      },
    );

    if (error) {
      logger.error("Supabase searchProviders error: %O", error);
      return [];
    }

    return (data || []) as Provider[];
  }

  async findProvidersByH3Indexes(h3Indexes: string[]): Promise<Provider[]> {
    const { data, error } = await this.client
      .from("providers")
      .select("*")
      .in("h3_index", h3Indexes)
      .order("name", { ascending: true });

    if (error) {
      logger.error("Supabase findProvidersByH3Indexes error: %O", error);
      return [];
    }

    return (data || []) as Provider[];
  }

  async searchHospitals(query: string): Promise<Hospital[]> {
    const { data, error } = await this.client
      .from("hospitals")
      .select(
        `
        id,
        provider_id,
        igd_phone,
        igd_email,
        bed_capacity,
        specializations,
        accreditation,
        rating,
        rating_count,
        website_url,
        provider_type,
        providers!inner (
          id,
          name,
          h3_index,
          latitude,
          longitude,
          provider_type,
          address,
          phone,
          created_at
        )
      `,
      )
      .eq("providers.provider_type", "rumah_sakit")
      .or(`name.ilike.%${query}%,igd_email.ilike.%${query}%`);

    if (error) {
      logger.error("Supabase searchHospitals error: %O", error);
      return [];
    }

    const results: Hospital[] = (data || []).map((item) => {
      const provider = item.providers.[0];
      if (!provider) {
        return null;
      }
      return {
        id: provider.id,
        name: provider.name,
        h3_index: provider.h3_index,
        latitude: provider.latitude,
        longitude: provider.longitude,
        provider_type: provider.provider_type,
        address: provider.address,
        phone: provider.phone,
        created_at: provider.created_at,
        igd_phone: item.igd_phone,
        igd_email: item.igd_email,
        bed_capacity: item.bed_capacity,
        specializations: item.specializations,
        accreditation: item.accreditation,
        rating: item.rating,
        rating_count: item.rating_count,
        website_url: item.website_url,
      } as Hospital;
    }).filter((h): h is Hospital => h !== null);

    return results;
  }

  async findHospitalsByH3Indexes(
    h3Indexes: string[],
  ): Promise<HospitalDetails[]> {
    const { data, error } = await this.client
      .from("hospitals")
      .select(
        `
        id,
        provider_id,
        igd_phone,
        igd_email,
        bed_capacity,
        specializations,
        accreditation,
        rating,
        rating_count,
        website_url,
        providers!inner (
          id,
          name,
          h3_index,
          latitude,
          longitude,
          provider_type,
          address,
          phone,
          created_at
        )
      `,
      )
      .eq("providers.provider_type", "rumah_sakit")
      .in("providers.h3_index", h3Indexes)
      .order("providers.name", { ascending: true });

    if (error) {
      logger.error("Supabase findHospitalsByH3Indexes error: %O", error);
      return [];
    }

    const results: HospitalDetails[] = (data || []).map((item) => {
      const provider = item.providers.[0];
      if (!provider) {
        return null;
      }
      return {
        id: provider.id,
        name: provider.name,
        h3_index: provider.h3_index,
        latitude: provider.latitude,
        longitude: provider.longitude,
        provider_type: provider.provider_type,
        address: provider.address,
        phone: provider.phone,
        created_at: provider.created_at,
        igd_phone: item.igd_phone,
        igd_email: item.igd_email,
        bed_capacity: item.bed_capacity,
        specializations: item.specializations,
        accreditation: item.accreditation,
        rating: item.rating,
        rating_count: item.rating_count,
        website_url: item.website_url,
      } as HospitalDetails;
    }).filter((h): h is HospitalDetails => h !== null);

    return results;
  }
}
