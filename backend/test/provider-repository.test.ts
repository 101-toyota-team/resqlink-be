import { vi, describe, it, expect, beforeEach } from "vitest";
import { SupabaseRepository } from "../src/infrastructure/supabase";
import { DatabaseSchemaDriftError } from "../src/utils/constants";

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ send: vi.fn() })),
    removeChannel: vi.fn(),
  })),
}));

describe("SupabaseRepository provider methods", () => {
  let repository: SupabaseRepository;
  const url = "https://test.supabase.co";
  const key = "test-key";

  const validProvider = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Provider",
    h3_index: "878c106a4ffffff",
    latitude: -6.2,
    longitude: 106.8,
    provider_type: "rumah_sakit",
    address: "Jl. Test No. 1",
    phone: "021-12345678",
    created_at: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SupabaseRepository(url, key);
  });

  describe("searchProviders", () => {
    it("returns parsed providers on success", async () => {
      mockRpc.mockResolvedValue({ data: [validProvider], error: null });

      const result = await repository.searchProviders("raw", "expanded");

      expect(mockRpc).toHaveBeenCalledWith("search_providers_optimized", {
        search_term: "expanded",
        raw_term: "raw",
      });
      expect(result).toEqual([validProvider]);
    });

    it("throws on RPC error", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      });

      await expect(
        repository.searchProviders("raw", "expanded"),
      ).rejects.toThrow("Supabase error: RPC failed");
    });

    it("throws DatabaseSchemaDriftError on schema mismatch", async () => {
      const invalidProvider = {
        ...validProvider,
        provider_type: "invalid_type",
      };
      mockRpc.mockResolvedValue({ data: [invalidProvider], error: null });

      await expect(
        repository.searchProviders("raw", "expanded"),
      ).rejects.toThrow(DatabaseSchemaDriftError);
    });
  });

  describe("findProvidersByH3Indexes", () => {
    it("returns parsed providers on success", async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ in: mockIn });
      mockIn.mockResolvedValue({ data: [validProvider], error: null });

      const h3Indexes = ["878c106a4ffffff"];
      const result = await repository.findProvidersByH3Indexes(h3Indexes);

      expect(mockFrom).toHaveBeenCalledWith("providers");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockIn).toHaveBeenCalledWith("h3_index", h3Indexes);
      expect(result).toEqual([validProvider]);
    });

    it("returns empty array for empty input", async () => {
      const result = await repository.findProvidersByH3Indexes([]);

      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("throws on DB error", async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ in: mockIn });
      mockIn.mockResolvedValue({ data: null, error: { message: "DB error" } });

      await expect(
        repository.findProvidersByH3Indexes(["878c106a4ffffff"]),
      ).rejects.toThrow("Supabase error: DB error");
    });

    it("throws DatabaseSchemaDriftError on schema mismatch", async () => {
      const invalidProvider = { ...validProvider, id: "not-a-uuid" };
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ in: mockIn });
      mockIn.mockResolvedValue({ data: [invalidProvider], error: null });

      await expect(
        repository.findProvidersByH3Indexes(["878c106a4ffffff"]),
      ).rejects.toThrow(DatabaseSchemaDriftError);
    });
  });
});
