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

const logger = {
  info: (...args: unknown[]) => {
    console.log(...formatLogArgs(args));
  },
  error: (...args: unknown[]) => {
    console.error(...formatLogArgs(args));
  },
  warn: (...args: unknown[]) => {
    console.warn(...formatLogArgs(args));
  },
};

export default logger;
