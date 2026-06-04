import type { ILogger } from "../types";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger implements ILogger {
  private level: number;
  private context: Record<string, unknown>;

  constructor(level?: string, context?: Record<string, unknown>) {
    const lvl = (level ?? "info").toLowerCase().trim() as LogLevel;
    this.level = LEVELS[lvl] ?? LEVELS.info;
    this.context = context ?? {};
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= this.level;
  }

  private serializeArgs(args: unknown[]): {
    message?: string;
    data?: unknown[];
  } {
    const strings = args.filter((a) => typeof a === "string");
    const nonStrings = args.filter((a) => typeof a !== "string");
    return {
      message: strings.length > 0 ? strings.join(" ") : undefined,
      data: nonStrings.length > 0 ? this.serialize(nonStrings) : undefined,
    };
  }

  private serialize(values: unknown[]): unknown[] {
    return values.map((v) => {
      if (v instanceof Error) {
        return {
          name: v.name,
          message: v.message,
          stack: v.stack,
          cause:
            v.cause instanceof Error
              ? { name: v.cause.name, message: v.cause.message }
              : v.cause,
        };
      }
      if (typeof v === "object" && v !== null) {
        try {
          return JSON.parse(JSON.stringify(v, this.circularReplacer()));
        } catch {
          return String(v);
        }
      }
      return v;
    });
  }

  private circularReplacer(): (key: string, value: unknown) => unknown {
    const seen = new WeakSet<object>();
    return (_key: string, value: unknown) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    };
  }

  private emit(level: LogLevel, args: unknown[]): void {
    if (!this.shouldLog(level)) return;
    const { message, data } = this.serializeArgs(args);
    const entry: Record<string, unknown> = {
      level,
      timestamp: new Date().toISOString(),
      ...this.context,
    };
    if (message) entry.message = message;
    if (data && data.length > 0)
      entry.data = data.length === 1 ? data[0] : data;

    const output = JSON.stringify(entry);
    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      default:
        console.log(output);
        break;
    }
  }

  info(...args: unknown[]): void {
    this.emit("info", args);
  }
  error(...args: unknown[]): void {
    this.emit("error", args);
  }
  warn(...args: unknown[]): void {
    this.emit("warn", args);
  }
  debug(...args: unknown[]): void {
    this.emit("debug", args);
  }

  child(context: Record<string, unknown>): ILogger {
    const levelName = (Object.entries(LEVELS).find(
      ([, v]) => v === this.level,
    )?.[0] ?? "info") as LogLevel;
    return new Logger(levelName, { ...this.context, ...context });
  }
}

export const logger = new Logger();
