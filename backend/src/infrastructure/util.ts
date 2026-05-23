import logger from "../utils/logger";

const MAX_RETRIES = 2;
const BASE_DELAY = 200;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      clearTimeout(id);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES) {
        const backoff = BASE_DELAY * Math.pow(2, attempt);
        logger.warn(
          "Fetch attempt %d failed for %s, retrying in %dms: %s",
          attempt + 1,
          url,
          backoff,
          lastError.message,
        );
        await delay(backoff);
      }
    }
  }

  throw lastError ?? new Error(`Fetch failed for ${url}`);
}
