/**
 * Cross-cutting public types shared across the layered core and resources.
 * Endpoint response shapes live in {@link ./models}.
 */

import type { NotifyAppli, Scope } from "../config/index.js";

/** A value that resolves to `T` synchronously or asynchronously. */
export type Awaitable<T> = T | Promise<T>;

/** A date accepted by helpers: `Date`, epoch seconds/ms, or an ISO/`YYYY-MM-DD` string. */
export type DateInput = Date | number | string;

/** A value that can be provided anywhere a scope is accepted. */
export type ScopeInput = Scope | string | Array<Scope | string>;

/** OAuth tokens as managed by the client. */
export interface Tokens {
  /** Bearer access token used to authorize data requests. */
  accessToken: string;
  /** Rotating refresh token used to obtain a new access token. */
  refreshToken: string;
  /** Withings user id the tokens belong to. */
  userId?: string;
  /** Granted scope string. */
  scope?: string;
  /** Absolute expiry of the access token, in **ms** since the Unix epoch. */
  expiresAt?: number;
}

/** Options common to every authenticated request. */
export interface RequestOptions {
  /**
   * Explicit access token. When omitted, the managed session token is used
   * (and auto-refreshed if stale).
   */
  accessToken?: string;
  /** Per-request `AbortSignal`. */
  signal?: AbortSignal;
}

/** Retry/backoff configuration. */
export interface RetryOptions {
  /** Maximum retry attempts after the initial request. Default `2`. */
  retries?: number;
  /** Base delay in ms for exponential backoff. Default `500`. */
  minTimeoutMs?: number;
  /** Upper bound in ms for a single backoff delay. Default `8000`. */
  maxTimeoutMs?: number;
}

/** A fully-resolved retry policy (internal). */
export type RetryPolicy = Required<RetryOptions>;

/** Context passed to the {@link Hooks.onRequest} hook. */
export interface RequestHookContext {
  url: string;
  params: Record<string, unknown>;
  attempt: number;
}

/** Context passed to the {@link Hooks.onResponse} hook. */
export interface ResponseHookContext {
  url: string;
  attempt: number;
  httpStatus: number;
  /** Withings business status, when the body parsed as an envelope. */
  status?: number;
  durationMs: number;
}

/** Context passed to the {@link Hooks.onRetry} hook. */
export interface RetryHookContext {
  url: string;
  attempt: number;
  delayMs: number;
  error: unknown;
}

/**
 * Observability hooks. Every hook is optional and may be async; a throwing or
 * rejecting hook never affects the request outcome.
 */
export interface Hooks {
  /** Fired immediately before each HTTP attempt (including retries). */
  onRequest?(ctx: RequestHookContext): Awaitable<void>;
  /** Fired after a response is received and parsed. */
  onResponse?(ctx: ResponseHookContext): Awaitable<void>;
  /** Fired when a failed attempt is about to be retried. */
  onRetry?(ctx: RetryHookContext): Awaitable<void>;
}

/** Requested authorization scopes and CSRF state for the authorize URL. */
export interface AuthorizeUrlOptions {
  /** Requested scopes. Accepts a `Scope`, a raw string, or an array. */
  scope: ScopeInput;
  /** Opaque CSRF value echoed back to the callback. Strongly recommended. */
  state?: string;
  /** Send the scope as-is instead of normalizing bare tokens to `user.*`. */
  rawScope?: boolean;
}

/** Raw OAuth token body returned by Withings. */
export interface RawTokenBody {
  userid: string;
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
  token_type: string;
  csrf_token?: string;
  [key: string]: unknown;
}

/** Notify (webhook) `appli`, accepting the enum or a raw number. */
export type AppliInput = NotifyAppli | number;
