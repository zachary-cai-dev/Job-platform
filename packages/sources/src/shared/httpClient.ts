export interface HttpClientConfig {
  maxRetries?: number;
  backoffBaseMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Defaults to true for existing adapters. Restricted sources can stop immediately on 429. */
  retry429?: boolean;
  signal?: AbortSignal;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  url: string,
  config: HttpClientConfig,
  parse: (response: Response) => Promise<T>,
): Promise<T> {
  const {
    maxRetries = 3,
    backoffBaseMs = 500,
    timeoutMs = 15000,
    headers = {},
    retry429 = true,
    signal,
  } = config;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      const response = await fetch(url, { headers, signal: requestSignal });
      clearTimeout(timeout);

      if (response.ok) {
        return await parse(response);
      }

      const retryable = (retry429 && response.status === 429) || response.status >= 500;
      if (!retryable || attempt >= maxRetries) {
        throw new HttpError(`HTTP ${response.status} from ${url}`, response.status, retryable);
      }
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof HttpError) {
        if (!error.retryable || attempt >= maxRetries) throw error;
      } else if (attempt >= maxRetries) {
        throw error;
      }
    }

    await sleep(backoffBaseMs * 2 ** attempt);
  }
}

/**
 * Retrying JSON fetch shared by every adapter. Retry count, backoff, and headers are
 * adapter-supplied config, not hardcoded here — each source tunes this to its own
 * published rate limits (docs/ingestion.md §2). 429 and 5xx are retried with
 * exponential backoff; other non-2xx statuses fail immediately (retrying a 404 or a
 * 401 just wastes the retry budget and delays surfacing a real problem).
 */
export async function fetchJson<T>(url: string, config: HttpClientConfig = {}): Promise<T> {
  return fetchWithRetry(url, config, (response) => response.json() as Promise<T>);
}

/** Same retry semantics as {@link fetchJson}, for RSS/XML sources that return plain text. */
export async function fetchText(url: string, config: HttpClientConfig = {}): Promise<string> {
  return fetchWithRetry(url, config, (response) => response.text());
}
