import type { Clock } from "../core/clock.js";
import type { Transport } from "../core/transport.js";
import type { RateLimiter, RateLimitOptions } from "../core/rate-limiter.js";
import type { TokenStore } from "../auth/token-store.js";
import type {
  Awaitable,
  Hooks,
  RetryOptions,
  RetryPolicy,
  Tokens,
} from "../types/index.js";

/** Default retry policy applied when `retry` is not `false`. */
export const DEFAULT_RETRY: RetryPolicy = {
  retries: 2,
  minTimeoutMs: 500,
  maxTimeoutMs: 8000,
};

/** Options accepted by the `WithingsClient` constructor. */
export interface WithingsClientOptions {
  /** Withings application client id. */
  clientId: string;
  /** Withings application client secret. */
  clientSecret: string;
  /** Registered OAuth2 redirect URI. */
  callbackURL: string;
  /** Seed the default in-memory token store (enables auto-refresh). */
  tokens?: Tokens;
  /**
   * Persist tokens through a custom {@link TokenStore} (e.g. Redis). When
   * provided, the `tokens` seed is ignored — seed your store yourself.
   */
  tokenStore?: TokenStore;
  /**
   * Invoked whenever tokens are (re)issued — on `exchangeCode`, `refresh`, or an
   * automatic refresh. Persist the rotated tokens here.
   */
  onTokenRefresh?: (tokens: Tokens) => Awaitable<void>;
  /** Retry configuration, or `false` to disable. Default enabled. */
  retry?: RetryOptions | false;
  /**
   * Opt-in client-side throttle to stay under Withings' 120 req/min cap. Pass
   * token-bucket options (e.g. `{ requestsPerMinute: 100 }`) or a custom
   * {@link RateLimiter}. Omit to disable (default).
   */
  rateLimit?: RateLimitOptions | RateLimiter;
  /** Per-request timeout in ms. Default `30000`. */
  timeoutMs?: number;
  /** Seconds of leeway before `expiresAt` at which to refresh. Default `60`. */
  refreshLeewaySeconds?: number;
  /** Observability hooks (onRequest / onResponse / onRetry). */
  hooks?: Hooks;
  /** Inject a custom {@link Transport}. Overrides `fetch`. */
  transport?: Transport;
  /** Inject a custom `fetch` (used to build the default transport). */
  fetch?: typeof fetch;
  /** Inject a custom {@link Clock} (deterministic time in tests). */
  clock?: Clock;
}
