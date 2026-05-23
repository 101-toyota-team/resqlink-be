import { describe, it, expect, vi } from "vitest";
import logger from "../src/utils/logger";

describe("logger", () => {
  it("should serialize plain objects in error calls", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error({ key: "val" }, "msg");
    expect(spy).toHaveBeenCalledWith('{"key":"val"}', "msg");
    spy.mockRestore();
  });

  it("should serialize plain objects in info calls", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info({ key: "val" }, "msg");
    expect(spy).toHaveBeenCalledWith('{"key":"val"}', "msg");
    spy.mockRestore();
  });

  it("should serialize plain objects in warn calls", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn({ key: "val" }, "msg");
    expect(spy).toHaveBeenCalledWith('{"key":"val"}', "msg");
    spy.mockRestore();
  });

  it("should pass through Error objects unchanged", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("test");
    logger.error(err);
    expect(spy).toHaveBeenCalledWith(err);
    spy.mockRestore();
  });

  it("should pass through strings unchanged", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("hello", "world");
    expect(spy).toHaveBeenCalledWith("hello", "world");
    spy.mockRestore();
  });

  it("should handle circular references without throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => logger.error(obj)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
