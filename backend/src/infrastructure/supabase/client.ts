import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "../util";

function isStringUrl(url: unknown): url is string {
  return typeof url === "string";
}

export class SupabaseClientBase {
  protected client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) => {
          if (!isStringUrl(url)) throw new Error("Fetch URL must be a string");
          return fetchWithTimeout(url, options);
        },
      },
    });
  }
}
