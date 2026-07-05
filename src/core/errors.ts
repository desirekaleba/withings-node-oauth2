/**
 * Error classes surfaced by the client.
 *
 * Every failure — whether a transport-level problem, a non-2xx HTTP response,
 * or a Withings business error (`status !== 0`) — is thrown as a
 * {@link WithingsError} (or one of its subclasses) so callers can `catch` a
 * single type and branch on `error.status`.
 */

export interface WithingsErrorOptions {
  /** Withings business status code (non-zero), when available. */
  status?: number;
  /** HTTP status code of the response, when available. */
  httpStatus?: number;
  /** Raw, parsed response body for debugging. */
  response?: unknown;
  /** Underlying error, if this wraps another failure. */
  cause?: unknown;
}

/**
 * Base error for all failures raised by the client.
 */
export class WithingsError extends Error {
  /** Withings business status code (non-zero) if the API returned one. */
  readonly status?: number;
  /** HTTP status code of the response, if any. */
  readonly httpStatus?: number;
  /** Raw, parsed response body for debugging. */
  readonly response?: unknown;

  constructor(message: string, options: WithingsErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "WithingsError";
    this.status = options.status;
    this.httpStatus = options.httpStatus;
    this.response = options.response;
    // Restore prototype chain for instanceof across transpile targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when authentication fails: an invalid, revoked or expired token,
 * or an invalid/expired signature or nonce.
 *
 * Corresponds to Withings status codes such as `100`, `214`, `283`, `342`
 * and HTTP `401`.
 */
export class WithingsAuthError extends WithingsError {
  constructor(message: string, options: WithingsErrorOptions = {}) {
    super(message, options);
    this.name = "WithingsAuthError";
  }
}

/**
 * Withings statuses (plus HTTP 401) for which obtaining a fresh access token
 * and retrying is likely to help — i.e. the token is invalid or expired. Other
 * auth failures (bad signature `342`, missing scope `214`, bad userid `247`)
 * are not fixed by a refresh.
 */
const REFRESHABLE_STATUSES = new Set([283, 401]);

/**
 * Whether an error is an auth failure that a token refresh + retry could
 * plausibly resolve.
 */
export function isRefreshableAuthError(err: unknown): boolean {
  return (
    err instanceof WithingsAuthError &&
    (REFRESHABLE_STATUSES.has(err.status ?? -1) || err.httpStatus === 401)
  );
}

/**
 * Thrown when a request exceeds the configured `timeoutMs` before a response
 * arrives. Retryable.
 */
export class WithingsTimeoutError extends WithingsError {
  constructor(message: string, options: WithingsErrorOptions = {}) {
    super(message, options);
    this.name = "WithingsTimeoutError";
  }
}

/**
 * Thrown when the request fails at the transport level (DNS, connection reset,
 * TLS, offline…) with no HTTP response. Retryable.
 */
export class WithingsNetworkError extends WithingsError {
  constructor(message: string, options: WithingsErrorOptions = {}) {
    super(message, options);
    this.name = "WithingsNetworkError";
  }
}

/**
 * Thrown when the caller aborts the request via their own `AbortSignal`. Never
 * retried.
 */
export class WithingsAbortError extends WithingsError {
  constructor(message: string, options: WithingsErrorOptions = {}) {
    super(message, options);
    this.name = "WithingsAbortError";
  }
}

/**
 * Thrown when the Withings rate limit is exceeded (status `601`).
 *
 * Standard applications are capped at 120 requests per minute.
 */
export class WithingsRateLimitError extends WithingsError {
  /**
   * Suggested seconds to wait before retrying, parsed from the `Retry-After`
   * header when present.
   */
  readonly retryAfter?: number;

  constructor(
    message: string,
    options: WithingsErrorOptions & { retryAfter?: number } = {},
  ) {
    super(message, options);
    this.name = "WithingsRateLimitError";
    this.retryAfter = options.retryAfter;
  }
}
