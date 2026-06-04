import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../src/utils/logger";

describe("Logger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should emit structured JSON with level and timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger("info");
    logger.info("hello");
    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output).toMatchObject({
      level: "info",
      timestamp: "2026-06-03T12:00:00.000Z",
      message: "hello",
    });
    spy.mockRestore();
  });

  it("should include context passed to constructor", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger("info", { requestId: "abc-123", method: "GET" });
    logger.info("test");
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.requestId).toBe("abc-123");
    expect(output.method).toBe("GET");
    spy.mockRestore();
  });

  it("should serialize Error objects with name, message, stack, and cause chain", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error("root cause");
    const err = new Error("wrapped", { cause });
    const logger = new Logger("error");
    logger.error(err);
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.data).toBeDefined();
    const serialized = output.data;
    expect(serialized.name).toBe("Error");
    expect(serialized.message).toBe("wrapped");
    expect(serialized.stack).toContain("Error: wrapped");
    expect(serialized.cause).toMatchObject({
      name: "Error",
      message: "root cause",
    });
    spy.mockRestore();
  });

  it("should not output debug messages when level is info", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger("info");
    logger.debug("should not appear");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should output debug messages when level is debug", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger("debug");
    logger.debug("debug message");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("should handle circular references without throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const logger = new Logger("error");
    expect(() => logger.error(obj)).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("should produce a child logger with merged context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const parent = new Logger("info", { requestId: "req-1" });
    const child = parent.child({ method: "POST" }) as Logger;
    child.info("from child");
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.requestId).toBe("req-1");
    expect(output.method).toBe("POST");
    expect(output.message).toBe("from child");
    spy.mockRestore();
  });

  it("should split message strings and data objects into separate fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger("info");
    logger.info("user created", { userId: 42 });
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.message).toBe("user created");
    expect(output.data).toMatchObject({ userId: 42 });
    spy.mockRestore();
  });

  it("should join multiple string arguments into a single message", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger("info");
    logger.info("hello", "world");
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.message).toBe("hello world");
    spy.mockRestore();
  });

  it("should use console.warn for warn level", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = new Logger("warn");
    logger.warn("warning");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("should use console.error for error level", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = new Logger("error");
    logger.error("error");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("should not share context mutations between parent and child", () => {
    const actor1 = new Logger("info", { userId: 1 });
    const actor2 = actor1.child({ userId: 2 });
    expect(
      (actor1 as unknown as { context: Record<string, unknown> }).context
        .userId,
    ).toBe(1);
    expect(
      (actor2 as unknown as { context: Record<string, unknown> }).context
        .userId,
    ).toBe(2);
  });

  it("should treat ' INFO ' (with whitespace) as info level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new Logger(" INFO ");
    logger.debug("should be suppressed");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
