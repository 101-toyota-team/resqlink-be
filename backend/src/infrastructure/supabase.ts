import { z } from "zod";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IBookingRepository } from "../repositories/booking";
import { IAmbulanceRepository } from "../repositories/ambulance";
import { IProviderRepository } from "../repositories/provider";
import { IHospitalRepository } from "../repositories/hospital";
import { IRealtimeBroadcaster } from "../repositories/realtime";
import {
  AmbulanceInfo,
  Booking,
  BookingData,
  AmbulanceDetails,
  AmbulanceLocation,
  Provider,
  Hospital,
  HospitalDetails,
} from "../types";
import type { BookingStatus } from "../utils/constants";
import { DatabaseSchemaDriftError } from "../utils/constants";
import { fetchWithTimeout } from "./util";
import logger from "../utils/logger";

import {
  dbBookingSchema,
  dbProviderSchema,
  dbHospitalSchema,
  dbAmbulanceDiscoverySchema,
  dbAmbulanceProviderSchema,
  dbAmbulanceSchema,
} from "../schemas/db";

function isStringUrl(url: unknown): url is string {
  return typeof url === "string";
}

export class SupabaseRepository
  implements
    IBookingRepository,
    IAmbulanceRepository,
    IProviderRepository,
    IHospitalRepository,
    IRealtimeBroadcaster
{
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

  async getAmbulance(ambulanceId: string): Promise<AmbulanceInfo | null> {
    const { data, error } = await this.client
      .from("ambulances")
      .select("id, provider_id")
      .eq("id", ambulanceId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      logger.error(error, "Supabase getAmbulance error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return dbAmbulanceSchema.parse(data);
    } catch (err) {
      logger.error(err, "Database schema drift detected in getAmbulance");
      throw new DatabaseSchemaDriftError("Ambulance", err);
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

  async findAvailableAmbulances(
    h3Indexes: string[],
  ): Promise<AmbulanceDetails[]> {
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
      logger.error(error, "Supabase findAvailableAmbulances error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      const results = dbAmbulanceDiscoverySchema.array().parse(data || []);
      return results.map((item) => {
        const provider = Array.isArray(item.providers)
          ? item.providers[0]
          : item.providers;
        return {
          id: item.id,
          lat: provider?.latitude ?? 0,
          lng: provider?.longitude ?? 0,
        };
      });
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in findAvailableAmbulances",
      );
      throw new DatabaseSchemaDriftError("Ambulance", err);
    }
  }

  async broadcastTripLocation(
    bookingId: string,
    location: AmbulanceLocation,
  ): Promise<void> {
    const channel = this.client.channel(`trip:${bookingId}`);
    try {
      await channel.send({
        type: "broadcast",
        event: "location_update",
        payload: location,
      });
    } finally {
      await this.client.removeChannel(channel);
    }
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
      logger.error(error, "Supabase getAmbulanceProviderLocation error");
      throw new Error(`Supabase error: ${error?.message}`, { cause: error });
    }

    try {
      const parsed = dbAmbulanceProviderSchema.parse(data);
      const providerData = parsed.providers;
      if (!providerData) return null;

      const provider = Array.isArray(providerData)
        ? providerData[0]
        : providerData;

      if (!provider) return null;

      return {
        lat: provider.latitude,
        lng: provider.longitude,
      };
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in getAmbulanceProviderLocation",
      );
      throw new DatabaseSchemaDriftError("AmbulanceProvider", err);
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

  private mapHospitalItem(
    item: z.infer<typeof dbHospitalSchema>,
  ): Hospital | null {
    const provider = Array.isArray(item.providers)
      ? item.providers[0]
      : item.providers;
    if (!provider) return null;
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
    };
  }

  async searchProviders(raw: string, expanded: string): Promise<Provider[]> {
    const { data, error } = await this.client.rpc(
      "search_providers_optimized",
      {
        search_term: expanded,
        raw_term: raw,
      },
    );

    if (error) {
      logger.error(error, "Supabase searchProviders error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return dbProviderSchema.array().parse(data || []);
    } catch (err) {
      logger.error(err, "Database schema drift detected in searchProviders");
      throw new DatabaseSchemaDriftError("Provider", err);
    }
  }

  async findProvidersByH3Indexes(h3Indexes: string[]): Promise<Provider[]> {
    if (h3Indexes.length === 0) return [];
    const { data, error } = await this.client
      .from("providers")
      .select("*")
      .in("h3_index", h3Indexes);

    if (error) {
      logger.error(error, "Supabase findProvidersByH3Indexes error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      return dbProviderSchema.array().parse(data || []);
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in findProvidersByH3Indexes",
      );
      throw new DatabaseSchemaDriftError("Provider", err);
    }
  }

  async searchHospitals(raw: string, expanded: string): Promise<Hospital[]> {
    const { data: ids, error: rpcError } = await this.client.rpc(
      "search_hospitals_optimized",
      { search_term: expanded, raw_term: raw },
    );

    if (rpcError) {
      logger.error(rpcError, "Supabase searchHospitals RPC error");
      throw new Error(`Supabase error: ${rpcError.message}`, {
        cause: rpcError,
      });
    }

    if (!ids || ids.length === 0) return [];

    const hospitalIds = ids.map((r: { hospital_id: string }) => r.hospital_id);
    const providerOrderMap = new Map(
      ids.map((r: { provider_id: string }, i: number) => [r.provider_id, i]),
    );

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
      .in("id", hospitalIds);

    if (error) {
      logger.error(error, "Supabase searchHospitals error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      const rawResults = dbHospitalSchema.array().parse(data || []);
      return rawResults
        .map((item): Hospital | null => this.mapHospitalItem(item))
        .filter((h): h is Hospital => h !== null)
        .sort(
          (a, b) =>
            ((providerOrderMap.get(a.id) ?? Infinity) as number) -
            ((providerOrderMap.get(b.id) ?? Infinity) as number),
        );
    } catch (err) {
      logger.error(err, "Database schema drift detected in searchHospitals");
      throw new DatabaseSchemaDriftError("Hospital", err);
    }
  }

  async findHospitalsByH3Indexes(
    h3Indexes: string[],
  ): Promise<HospitalDetails[]> {
    if (h3Indexes.length === 0) return [];
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
      logger.error(error, "Supabase findHospitalsByH3Indexes error");
      throw new Error(`Supabase error: ${error.message}`, { cause: error });
    }

    try {
      const rawResults = dbHospitalSchema.array().parse(data || []);
      return rawResults
        .map((item): HospitalDetails | null => this.mapHospitalItem(item))
        .filter((h): h is HospitalDetails => h !== null);
    } catch (err) {
      logger.error(
        err,
        "Database schema drift detected in findHospitalsByH3Indexes",
      );
      throw new DatabaseSchemaDriftError("Hospital", err);
    }
  }
}
