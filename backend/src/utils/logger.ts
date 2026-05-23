import type { ILogger } from "../types";

function formatLogArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    if (typeof a === "object" && a !== null && !(a instanceof Error)) {
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    }
    return a;
  });
}

export class Logger implements ILogger {
  info(...args: unknown[]): void {
    console.log(...formatLogArgs(args));
  }

  error(...args: unknown[]): void {
    console.error(...formatLogArgs(args));
  }

  warn(...args: unknown[]): void {
    console.warn(...formatLogArgs(args));
  }
}

const logger = new Logger();

export default logger;
