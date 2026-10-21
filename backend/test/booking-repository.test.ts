import { vi, describe, it, expect, beforeEach } from "vitest";
import { BookingRepository } from "../src/infrastructure/supabase/booking";
import { BookingStateError } from "../src/utils/errors";
import { ILogger } from "../src/types";

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
} as unknown as ILogger;

const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockEqId = vi.fn();
const mockEqStatus = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

describe("BookingRepository.updateBookingStatus", () => {
  let repository: BookingRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEqId });
    mockEqId.mockReturnValue({ eq: mockEqStatus });
    mockEqStatus.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });

    repository = new BookingRepository(
      "https://test.supabase.co",
      "test-key",
      mockLogger,
    );
  });

  it("only updates the row when it still has the expected status", async () => {
    mockSingle.mockResolvedValue({ data: { id: "booking_1" }, error: null });

    await repository.updateBookingStatus("booking_1", "draft", "confirmed");

    expect(mockUpdate).toHaveBeenCalledWith({ status: "confirmed" });
    expect(mockEqId).toHaveBeenCalledWith("id", "booking_1");
    expect(mockEqStatus).toHaveBeenCalledWith("status", "draft");
  });

  it("throws BookingStateError when the status already changed", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows returned" },
    });

    await expect(
      repository.updateBookingStatus("booking_1", "draft", "confirmed"),
    ).rejects.toThrow(BookingStateError);
  });
});
