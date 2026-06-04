import { describe, it, expect, vi } from "vitest";
import { GeoService } from "../src/services/geo";
import { ILogger } from "../src/types";

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
} as unknown as ILogger;

const geo = new GeoService(mockLogger);

describe("GeoService.parseLatLng", () => {
  it("parses valid coordinate string", () => {
    expect(geo.parseLatLng("12.3,45.6")).toEqual({ lat: 12.3, lng: 45.6 });
  });

  it("parses negative coordinates", () => {
    expect(geo.parseLatLng("-6.2,106.8")).toEqual({ lat: -6.2, lng: 106.8 });
  });

  it("throws on empty string", () => {
    expect(() => geo.parseLatLng("")).toThrow(/coordinate/i);
  });

  it("throws on non-string input", () => {
    expect(() => geo.parseLatLng(null as unknown as string)).toThrow(
      /coordinate/i,
    );
  });

  it("throws on more than 2 values", () => {
    expect(() => geo.parseLatLng("1,2,3")).toThrow(/2 comma-separated/i);
  });

  it("throws on single value", () => {
    expect(() => geo.parseLatLng("1")).toThrow(/2 comma-separated/i);
  });

  it("throws on lat out of range", () => {
    expect(() => geo.parseLatLng("999,45.6")).toThrow(/out of range/i);
  });

  it("throws on lng out of range", () => {
    expect(() => geo.parseLatLng("12.3,999")).toThrow(/out of range/i);
  });

  it("throws on NaN lat", () => {
    expect(() => geo.parseLatLng("abc,45.6")).toThrow(/coordinate values/i);
  });

  it("throws on NaN lng", () => {
    expect(() => geo.parseLatLng("12.3,xyz")).toThrow(/coordinate values/i);
  });
});

describe("GeoService.haversineDistance", () => {
  it("returns 0 for same point", () => {
    expect(geo.haversineDistance(0, 0, 0, 0)).toBe(0);
  });

  it("returns ~111km for 1 degree of latitude", () => {
    const dist = geo.haversineDistance(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  it("returns ~111km for 1 degree of longitude at equator", () => {
    const dist = geo.haversineDistance(0, 0, 0, 1);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  it("is symmetric", () => {
    const a = geo.haversineDistance(-6.2, 106.8, -7.8, 110.4);
    const b = geo.haversineDistance(-7.8, 110.4, -6.2, 106.8);
    expect(a).toBeCloseTo(b, 5);
  });
});

describe("GeoService H3 helpers", () => {
  it("latLngToCell produces a valid H3 index at resolution 7", () => {
    const cell = geo.latLngToCell(-6.2, 106.8, 7);
    expect(cell).toHaveLength(15);
    expect(cell.startsWith("8")).toBe(true);
  });

  it("cellToLatLng reverses latLngToCell", () => {
    const orig = { lat: -6.2, lng: 106.8 };
    const cell = geo.latLngToCell(orig.lat, orig.lng, 7);
    const back = geo.cellToLatLng(cell);
    expect(back.lat).toBeCloseTo(orig.lat, 1);
    expect(back.lng).toBeCloseTo(orig.lng, 1);
  });

  it("getNeighbors returns 7 cells for radius 1", () => {
    const cell = geo.latLngToCell(-6.2, 106.8, 7);
    const neighbors = geo.getNeighbors(cell, 1);
    expect(neighbors).toHaveLength(7);
  });

  it("getNeighbors returns 19 cells for radius 2", () => {
    const cell = geo.latLngToCell(-6.2, 106.8, 7);
    const neighbors = geo.getNeighbors(cell, 2);
    expect(neighbors).toHaveLength(19);
  });
});
