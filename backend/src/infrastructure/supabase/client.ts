import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "../util";
import type { ILogger } from "../../types";

function isStringUrl(url: unknown): url is string {
  return typeof url === "string";
}

export class SupabaseClientBase {
  protected client: SupabaseClient;
  protected logger: ILogger;

  constructor(url: string, key: string, logger: ILogger) {
    this.client = createClient(url, key, {
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) => {
          if (!isStringUrl(url)) throw new Error("Fetch URL must be a string");
          return fetchWithTimeout(url, options);
        },
      },
    });
    this.logger = logger;
  }
}
