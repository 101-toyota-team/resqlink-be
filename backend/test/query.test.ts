import { describe, it, expect } from "vitest";
import { preprocessQuery } from "../src/utils/query";

describe("preprocessQuery", () => {
  it("returns trimmed raw query", () => {
    const result = preprocessQuery("  rumah sakit  ");
    expect(result.raw).toBe("rumah sakit");
  });

  it("expands known abbreviation: rs", () => {
    const result = preprocessQuery("rs");
    expect(result.expanded).toBe("Rumah Sakit");
  });

  it("expands known abbreviation: rsud", () => {
    const result = preprocessQuery("rsud");
    expect(result.expanded).toBe("Rumah Sakit Umum Daerah");
  });

  it("expands known abbreviation: rsia", () => {
    const result = preprocessQuery("rsia");
    expect(result.expanded).toBe("Rumah Sakit Ibu dan Anak");
  });

  it("expands known abbreviation: puskesmas", () => {
    const result = preprocessQuery("puskesmas");
    expect(result.expanded).toBe("Pusat Kesehatan Masyarakat");
  });

  it("passes through unknown words unchanged", () => {
    const result = preprocessQuery("hospital");
    expect(result.expanded).toBe("hospital");
  });

  it("expands abbreviation within multi-word query", () => {
    const result = preprocessQuery("rs jakarta");
    expect(result.expanded).toBe("Rumah Sakit jakarta");
  });

  it("is case-insensitive for abbreviations", () => {
    const result = preprocessQuery("RS");
    expect(result.expanded).toBe("Rumah Sakit");
  });

  it("preserves original casing for non-abbreviations", () => {
    const result = preprocessQuery("Jakarta");
    expect(result.expanded).toBe("Jakarta");
  });
});
