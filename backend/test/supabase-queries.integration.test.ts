import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { HospitalRepository } from "../src/infrastructure/supabase/hospital";
import { ProviderRepository } from "../src/infrastructure/supabase/provider";

// NOTE: These integration tests actually hit the database specified in .dev.vars.
// They assert that the SQL queries and RPC calls are structurally correct and
// do not throw PostgREST errors like PGRST100 (syntax) or PGRST203 (overload ambiguity).
describe("Supabase Real Query Integration Tests", () => {
  describe("ProviderRepository", () => {
    it("should successfully execute searchProviders without throwing PGRST203", async () => {
      const providerRepo = new ProviderRepository(
        (env as unknown as Record<string, string>).SUPABASE_URL as string,
        (env as unknown as Record<string, string>)
          .SUPABASE_SECRET_KEY as string,
      );

      // Attempt a search both with and without explicit limit to ensure no RPC ambiguity
      const resWithLimit = await providerRepo.searchProviders(
        "klinik",
        "klinik",
        5,
      );
      expect(Array.isArray(resWithLimit)).toBe(true);

      const resWithoutLimit = await providerRepo.searchProviders(
        "klinik",
        "klinik",
      );
      expect(Array.isArray(resWithoutLimit)).toBe(true);
    });

    it("should successfully execute findProvidersByH3Indexes", async () => {
      const providerRepo = new ProviderRepository(
        (env as unknown as Record<string, string>).SUPABASE_URL as string,
        (env as unknown as Record<string, string>)
          .SUPABASE_SECRET_KEY as string,
      );

      const results = await providerRepo.findProvidersByH3Indexes([
        "878c106a4ffffff",
      ]);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("HospitalRepository", () => {
    it("should successfully execute searchHospitals without throwing PGRST203", async () => {
      const hospitalRepo = new HospitalRepository(
        (env as unknown as Record<string, string>).SUPABASE_URL as string,
        (env as unknown as Record<string, string>)
          .SUPABASE_SECRET_KEY as string,
      );

      const resWithLimit = await hospitalRepo.searchHospitals("rs", "rs", 5);
      expect(Array.isArray(resWithLimit)).toBe(true);

      const resWithoutLimit = await hospitalRepo.searchHospitals("rs", "rs");
      expect(Array.isArray(resWithoutLimit)).toBe(true);
    });

    it("should successfully execute findHospitalsByH3Indexes without throwing PGRST100", async () => {
      const hospitalRepo = new HospitalRepository(
        (env as unknown as Record<string, string>).SUPABASE_URL as string,
        (env as unknown as Record<string, string>)
          .SUPABASE_SECRET_KEY as string,
      );

      // 878c106a4ffffff is a valid H3 index form
      const results = await hospitalRepo.findHospitalsByH3Indexes([
        "878c106a4ffffff",
        "878cf3d5cffffff",
      ]);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
