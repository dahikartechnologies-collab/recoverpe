export interface ResilientFetchOptions {
  /** Abort an individual attempt after this long. */
  timeoutMs?: number;
  /** Total attempts including the first. */
  maxAttempts?: number;
  /** Base delay for exponential backoff. */
  baseDelayMs?: number;
  /** Label used in retry logs. */
  scope?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 4xx means the request itself is wrong — retrying sends the same bad payload
 * and, for message sends, risks duplicate delivery once the upstream recovers.
 * Only transient server-side and transport failures are worth another attempt.
 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * fetch with a per-attempt timeout and bounded exponential backoff.
 *
 * Node's fetch has no default timeout, so a hung upstream connection would
 * otherwise occupy the serverless invocation until the platform kills it.
 */
export async function resilientFetch(
  input: string,
  init: RequestInit = {},
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const scope = options.scope ?? "fetch";

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!isRetryableStatus(response.status) || attempt === maxAttempts) {
        return response;
      }

      console.warn(
        `[${scope}] Attempt ${attempt}/${maxAttempts} got ${response.status}; retrying.`
      );
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      console.warn(
        `[${scope}] Attempt ${attempt}/${maxAttempts} failed:`,
        error instanceof Error ? error.message : error
      );
    }

    await sleep(baseDelayMs * 2 ** (attempt - 1));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${scope} failed after ${maxAttempts} attempts.`);
}

/**
 * Retries an arbitrary async call with the same backoff policy. Used for SDK
 * clients such as Vertex AI that do not expose the underlying fetch.
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: Omit<ResilientFetchOptions, "timeoutMs"> = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const scope = options.scope ?? "operation";

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      console.warn(
        `[${scope}] Attempt ${attempt}/${maxAttempts} failed:`,
        error instanceof Error ? error.message : error
      );

      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${scope} failed after ${maxAttempts} attempts.`);
}
