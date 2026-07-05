import { WithingsAbortError } from "./errors.js";
import type { Clock } from "./clock.js";

/**
 * Gates outbound requests. Implement this to plug in a custom throttling
 * strategy (e.g. a distributed limiter shared across processes).
 */
export interface RateLimiter {
  /**
   * Resolve when it is permissible to send the next request. Reject with a
   * {@link WithingsAbortError} if `signal` aborts while waiting.
   */
  acquire(signal?: AbortSignal): Promise<void>;
}

/** Options for the built-in {@link TokenBucketRateLimiter}. */
export interface RateLimitOptions {
  /** Sustained request rate. Withings caps standard apps at 120/min. */
  requestsPerMinute: number;
  /**
   * Maximum burst size (bucket capacity). Defaults to `requestsPerMinute`,
   * allowing a full minute's worth of requests to burst before throttling.
   */
  burst?: number;
}

/** A cancellable delay. Injected for deterministic testing. */
export type Delay = (ms: number, signal?: AbortSignal) => Promise<void>;

const defaultDelay: Delay = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new WithingsAbortError("Rate-limit wait aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new WithingsAbortError("Rate-limit wait aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/**
 * A monotonically-refilling token-bucket rate limiter. Tokens replenish
 * continuously at `requestsPerMinute`; each {@link acquire} consumes one,
 * waiting when the bucket is empty. Keeps a client comfortably under Withings'
 * documented limit instead of reacting to `601` responses.
 */
export class TokenBucketRateLimiter implements RateLimiter {
  readonly #capacity: number;
  readonly #refillPerMs: number;
  readonly #clock: Clock;
  readonly #delay: Delay;
  #tokens: number;
  #last: number;
  // Serialize waiters so tokens are handed out in FIFO order.
  #tail: Promise<void> = Promise.resolve();

  constructor(
    options: RateLimitOptions,
    clock: Clock,
    delay: Delay = defaultDelay,
  ) {
    if (options.requestsPerMinute <= 0) {
      throw new RangeError("requestsPerMinute must be greater than 0");
    }
    this.#capacity = Math.max(1, options.burst ?? options.requestsPerMinute);
    this.#refillPerMs = options.requestsPerMinute / 60_000;
    this.#clock = clock;
    this.#delay = delay;
    this.#tokens = this.#capacity;
    this.#last = clock.now();
  }

  acquire(signal?: AbortSignal): Promise<void> {
    // Chain onto the tail so concurrent callers queue rather than race.
    const result = this.#tail.then(() => this.#take(signal));
    // Swallow rejection on the tail chain so one aborted waiter doesn't poison
    // the queue for the next.
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #refill(): void {
    const now = this.#clock.now();
    const elapsed = now - this.#last;
    if (elapsed > 0) {
      this.#tokens = Math.min(
        this.#capacity,
        this.#tokens + elapsed * this.#refillPerMs,
      );
      this.#last = now;
    }
  }

  async #take(signal?: AbortSignal): Promise<void> {
    for (;;) {
      if (signal?.aborted) {
        throw new WithingsAbortError("Rate-limit wait aborted");
      }
      this.#refill();
      if (this.#tokens >= 1) {
        this.#tokens -= 1;
        return;
      }
      const waitMs = Math.ceil((1 - this.#tokens) / this.#refillPerMs);
      await this.#delay(waitMs, signal);
    }
  }
}
