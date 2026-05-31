import { describe, it, expect } from "vitest";
import { decodePolyline } from "../src/utils/polyline";

describe("decodePolyline (Precision 6)", () => {
  it("should decode a simple coordinate pair", () => {
    // (38.5, -120.2) encoded with precision 6
    const encoded = "_izlhA~rlgdF";
    const result = decodePolyline(encoded);
    expect(result).toHaveLength(1);
    expect(result[0].lat).toBeCloseTo(38.5, 6);
    expect(result[0].lng).toBeCloseTo(-120.2, 6);
  });

  it("should decode multiple coordinates", () => {
    // (38.5, -120.2) and (40.7, -120.95)
    // 40.7 * 1e6 = 40700000
    // -120.95 * 1e6 = -120950000
    // diffs: 2.2 * 1e6 = 2200000, -0.75 * 1e6 = -750000
    const encoded = "_izlhA~rlgdF_{geC~ywl@";
    const result = decodePolyline(encoded);
    expect(result).toHaveLength(2);
    expect(result[0].lat).toBeCloseTo(38.5, 6);
    expect(result[0].lng).toBeCloseTo(-120.2, 6);
    expect(result[1].lat).toBeCloseTo(40.7, 6);
    expect(result[1].lng).toBeCloseTo(-120.95, 6);
  });

  it("should return empty array for invalid string", () => {
    const result = decodePolyline("invalid");
    expect(result).toEqual([]);
  });

  it("should handle empty string", () => {
    const result = decodePolyline("");
    expect(result).toEqual([]);
  });
});
