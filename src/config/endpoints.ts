/**
 * Withings API hosts and endpoint paths.
 *
 * @remarks
 * Withings is famously inconsistent about the `/v2` prefix. In particular,
 * `measure/getmeas` lives at the bare `/measure` path while the `measurev2`
 * actions (`getactivity`, `getintradayactivity`, `getworkouts`) live at
 * `/v2/measure`. These constants encode those quirks so callers never have to.
 *
 * @see https://developer.withings.com/api-reference
 */

/** OAuth2 authorization page the user is redirected to. */
export const AUTHORIZE_URL =
  "https://account.withings.com/oauth2_user/authorize2";

/** Base host for all data and service API calls. */
export const API_BASE = "https://wbsapi.withings.net";

/** Fully-qualified endpoint URLs, keyed by purpose. */
export const ENDPOINTS = {
  /** Nonce + signature service. */
  signature: `${API_BASE}/v2/signature`,
  /** OAuth2 token request/refresh. */
  oauth2: `${API_BASE}/v2/oauth2`,
  /** User service (devices, goals). */
  user: `${API_BASE}/v2/user`,
  /** Body measures (`getmeas`) — note the bare, non-v2 path. */
  measure: `${API_BASE}/measure`,
  /** Activity/workout service (`measurev2`). */
  measurev2: `${API_BASE}/v2/measure`,
  /** Heart / ECG service. */
  heart: `${API_BASE}/v2/heart`,
  /** Sleep service. */
  sleep: `${API_BASE}/v2/sleep`,
  /** Notify (webhook) service. */
  notify: `${API_BASE}/notify`,
} as const;

/** Withings API `status` value that indicates success. */
export const STATUS_OK = 0;
