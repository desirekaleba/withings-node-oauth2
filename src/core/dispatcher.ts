import {
  WithingsAbortError,
  WithingsAuthError,
  WithingsError,
  WithingsNetworkError,
  WithingsRateLimitError,
  WithingsTimeoutError,
} from "./errors.js";
import { STATUS_OK, describeStatus } from "../config/index.js";
import type { Hooks, RetryPolicy } from "../types/index.js";
import type { Clock } from "./clock.js";
import type { RateLimiter } from "./rate-limiter.js";
import type { Transport } from "./transport.js";

/** Withings status codes that indicate an auth/signature problem. */
const AUTH_STATUS_CODES = new Set([100, 214, 247, 283, 342, 401]);
/** Withings status code for rate limiting. */
const RATE_LIMIT_STATUS = 601;

/** Envelope every Withings endpoint wraps its payload in. */
interface Envelope<T> {
  status: number;
  body?: T;
  error?: string;
}

/** Per-request inputs to {@link Dispatcher.request}. */
export interface DispatchOptions {
  accessToken?: string;
  signal?: AbortSignal;
}

/** Configuration for a {@link Dispatcher}. */
export interface DispatcherConfig {
  transport: Transport;
  clock: Clock;
  retry: RetryPolicy | false;
  timeoutMs: number;
  hooks: Hooks;
  rateLimiter?: RateLimiter;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Encode a flat params object as `application/x-www-form-urlencoded`. */
function encodeForm(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.append(key, String(value));
  }
  return search.toString();
}

function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function classify(
  status: number,
  message: string,
  response: unknown,
  httpStatus: number,
  retryAfter?: number,
): WithingsError {
  if (status === RATE_LIMIT_STATUS) {
    return new WithingsRateLimitError(message, {
      status,
      httpStatus,
      response,
      retryAfter,
    });
  }
  if (AUTH_STATUS_CODES.has(status)) {
    return new WithingsAuthError(message, { status, httpStatus, response });
  }
  return new WithingsError(message, { status, httpStatus, response });
}

/**
 * The Withings request executor. It owns everything between "I have an endpoint
 * and params" and "I have a typed body or a typed error": form encoding, the
 * `Authorization` header, per-request timeouts, retry with exponential backoff
 * and full jitter, `Retry-After`, envelope unwrapping, error classification, and
 * the observability hooks. It delegates the actual round-trip to a
 * {@link Transport}.
 */
export class Dispatcher {
  readonly #transport: Transport;
  readonly #clock: Clock;
  readonly #retry: RetryPolicy | false;
  readonly #timeoutMs: number;
  readonly #hooks: Hooks;
  readonly #rateLimiter?: RateLimiter;

  constructor(config: DispatcherConfig) {
    this.#transport = config.transport;
    this.#clock = config.clock;
    this.#retry = config.retry;
    this.#timeoutMs = config.timeoutMs;
    this.#hooks = config.hooks;
    this.#rateLimiter = config.rateLimiter;
  }

  /** Backoff delay for a given zero-based attempt, with full jitter. */
  #backoff(attempt: number): number {
    if (!this.#retry) return 0;
    const capped = Math.min(
      this.#retry.minTimeoutMs * 2 ** attempt,
      this.#retry.maxTimeoutMs,
    );
    return Math.round(Math.random() * capped);
  }

  #maxAttempts(): number {
    return this.#retry ? this.#retry.retries + 1 : 1;
  }

  async #emit<C>(
    hook: ((ctx: C) => unknown) | undefined,
    ctx: C,
  ): Promise<void> {
    if (!hook) return;
    try {
      await hook(ctx);
    } catch {
      // Observability hooks must never affect the request outcome.
    }
  }

  /**
   * POST a form-encoded request, returning the typed `body` on success or
   * throwing a typed {@link WithingsError}.
   */
  async request<T>(
    url: string,
    params: Record<string, unknown>,
    options: DispatchOptions = {},
  ): Promise<T> {
    const maxAttempts = this.#maxAttempts();
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const isLast = attempt === maxAttempts - 1;
      // Gate on the rate limiter (if any) — this counts retries against the
      // budget and propagates a caller abort while waiting.
      if (this.#rateLimiter) await this.#rateLimiter.acquire(options.signal);
      await this.#emit(this.#hooks.onRequest, { url, params, attempt });

      const started = this.#clock.now();
      const outcome = await this.#attempt<T>(url, params, options);

      if (outcome.kind === "ok") {
        await this.#emit(this.#hooks.onResponse, {
          url,
          attempt,
          httpStatus: outcome.httpStatus,
          status: STATUS_OK,
          durationMs: this.#clock.now() - started,
        });
        return outcome.body;
      }

      if (outcome.kind === "fail") {
        await this.#emit(this.#hooks.onResponse, {
          url,
          attempt,
          httpStatus: outcome.httpStatus,
          status: outcome.status,
          durationMs: this.#clock.now() - started,
        });
      }

      // Non-retryable, or attempts exhausted.
      if (!outcome.retryable || isLast) throw outcome.error;

      lastError = outcome.error;
      const delayMs =
        outcome.retryAfter !== undefined
          ? outcome.retryAfter * 1000
          : this.#backoff(attempt);
      await this.#emit(this.#hooks.onRetry, {
        url,
        attempt,
        delayMs,
        error: outcome.error,
      });
      await sleep(delayMs);
    }

    // Unreachable in practice; the loop returns or throws.
    throw lastError instanceof WithingsError
      ? lastError
      : new WithingsError("Request failed after retries", { cause: lastError });
  }

  /** Perform one attempt and describe its outcome without deciding policy. */
  async #attempt<T>(
    url: string,
    params: Record<string, unknown>,
    options: DispatchOptions,
  ): Promise<AttemptOutcome<T>> {
    // Short-circuit an already-aborted request without touching the transport.
    if (options.signal?.aborted) {
      return {
        kind: "fatal",
        retryable: false,
        httpStatus: 0,
        error: new WithingsAbortError("Request aborted by caller", {
          cause: options.signal.reason,
        }),
      };
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason);
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason);
      else options.signal.addEventListener("abort", onAbort, { once: true });
    }
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      };
      if (options.accessToken) {
        headers.Authorization = `Bearer ${options.accessToken}`;
      }

      const res = await this.#transport.request(url, {
        method: "POST",
        headers,
        body: encodeForm(params),
        signal: controller.signal,
      });

      // Transient HTTP failure: retryable, no envelope to read.
      if (res.status >= 500 || res.status === 429) {
        return {
          kind: "transport",
          retryable: Boolean(this.#retry),
          retryAfter: parseRetryAfter(res.headers),
          httpStatus: res.status,
          error: new WithingsError(`HTTP ${res.status} from Withings`, {
            httpStatus: res.status,
          }),
        };
      }

      const text = await res.text();
      let payload: Envelope<T>;
      try {
        payload = text ? (JSON.parse(text) as Envelope<T>) : { status: -1 };
      } catch {
        return {
          kind: "fatal",
          retryable: false,
          httpStatus: res.status,
          error: new WithingsError(
            `Withings returned a non-JSON response (HTTP ${res.status})`,
            { httpStatus: res.status, response: text },
          ),
        };
      }

      if (payload.status === STATUS_OK) {
        return {
          kind: "ok",
          httpStatus: res.status,
          body: (payload.body ?? ({} as T)) as T,
        };
      }

      const retryAfter = parseRetryAfter(res.headers);
      const description = describeStatus(payload.status);
      const message =
        payload.error ||
        [
          `Withings API error (status ${payload.status}, HTTP ${res.status})`,
          description,
        ]
          .filter(Boolean)
          .join(": ");
      const error = classify(
        payload.status,
        message,
        payload,
        res.status,
        retryAfter,
      );
      return {
        kind: "fail",
        status: payload.status,
        httpStatus: res.status,
        retryable: error instanceof WithingsRateLimitError,
        retryAfter,
        error,
      };
    } catch (err) {
      // Caller-initiated abort: surface immediately, never retry.
      if (options.signal?.aborted) {
        return {
          kind: "fatal",
          retryable: false,
          httpStatus: 0,
          error: new WithingsAbortError("Request aborted by caller", {
            cause: err,
          }),
        };
      }
      // Our own timeout fired.
      if (timedOut) {
        return {
          kind: "transport",
          retryable: Boolean(this.#retry),
          httpStatus: 0,
          error: new WithingsTimeoutError(
            `Request timed out after ${this.#timeoutMs}ms`,
            { cause: err },
          ),
        };
      }
      // Anything else is a transport/network failure.
      return {
        kind: "transport",
        retryable: Boolean(this.#retry),
        httpStatus: 0,
        error:
          err instanceof WithingsError
            ? err
            : new WithingsNetworkError(
                err instanceof Error ? err.message : "Network request failed",
                { cause: err },
              ),
      };
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
}

type AttemptOutcome<T> =
  | { kind: "ok"; httpStatus: number; body: T }
  | {
      kind: "fail";
      status: number;
      httpStatus: number;
      retryable: boolean;
      retryAfter?: number;
      error: WithingsError;
    }
  | {
      kind: "transport";
      httpStatus: number;
      retryable: boolean;
      retryAfter?: number;
      error: WithingsError;
    }
  | {
      kind: "fatal";
      httpStatus: number;
      retryable: false;
      error: WithingsError;
    };
