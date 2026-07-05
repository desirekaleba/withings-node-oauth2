/**
 * withings-node-oauth2 — a modern, fully-typed, zero-dependency Node.js client
 * for the Withings OAuth2 Health Data & Notify (webhook) API.
 *
 * @packageDocumentation
 */

// Composition root
export { WithingsClient } from "./client/client.js";
export type { WithingsClientOptions } from "./client/options.js";

// Errors
export {
  WithingsError,
  WithingsAuthError,
  WithingsRateLimitError,
  WithingsTimeoutError,
  WithingsNetworkError,
  WithingsAbortError,
  type WithingsErrorOptions,
} from "./core/errors.js";

// Enums, endpoints & status-code catalog
export {
  Scope,
  NotifyAppli,
  MeasureType,
  AUTHORIZE_URL,
  API_BASE,
  ENDPOINTS,
  STATUS_DESCRIPTIONS,
  describeStatus,
} from "./config/index.js";

// Core interfaces (for injection / advanced use)
export { type Clock, systemClock } from "./core/clock.js";
export {
  FetchTransport,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from "./core/transport.js";
export { MemoryTokenStore, type TokenStore } from "./auth/token-store.js";
export {
  TokenBucketRateLimiter,
  type RateLimiter,
  type RateLimitOptions,
} from "./core/rate-limiter.js";

// Resources (classes + option types, for consumers referencing them directly)
export { OAuthResource, formatScope } from "./resources/oauth.js";
export {
  MeasuresResource,
  type MeasuresListOptions,
} from "./resources/measures.js";
export {
  ActivityResource,
  type ActivityDailyOptions,
  type IntradayActivityOptions,
} from "./resources/activity.js";
export {
  WorkoutsResource,
  type WorkoutsListOptions,
} from "./resources/workouts.js";
export {
  SleepResource,
  type SleepSummaryOptions,
  type SleepGetOptions,
} from "./resources/sleep.js";
export {
  HeartResource,
  type HeartListOptions,
  type EcgGetOptions,
} from "./resources/heart.js";
export { DevicesResource } from "./resources/devices.js";
export { GoalsResource } from "./resources/goals.js";
export {
  NotifyResource,
  type NotifySubscribeOptions,
  type NotifyGetOptions,
  type NotifyListOptions,
  type NotifyUpdateOptions,
  type NotifyRevokeOptions,
} from "./resources/notify.js";

// Helpers & utilities
export { generateSignature } from "./core/crypto.js";
export { toDate, toEpochSeconds, toYmd } from "./util/dates.js";
export { realValue, findMeasure, measureValue } from "./util/measures.js";
export { parseNotifyEvent, type NotifyEventInput } from "./util/webhook.js";

// Shared types & response models
export type * from "./types/index.js";
export type * from "./models/index.js";

import { WithingsClient } from "./client/client.js";

/**
 * @deprecated Renamed to {@link WithingsClient} in v2. This alias eases
 * migration and will be removed in v3.
 */
export const WithingsNodeOauth2 = WithingsClient;
