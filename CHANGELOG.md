# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] - 2026-07-05

A ground-up TypeScript rewrite. Same concepts, a cleaner and safer surface.

### Added

- **Full TypeScript rewrite** with first-class types for every option and
  response body, shipped as dual **ESM + CommonJS** with `.d.ts` declarations.
- **Namespaced, resource-oriented API** over a layered core
  (`Transport` → `Dispatcher` → `Signer` / `TokenManager` → resources):
  `wc.oauth`, `wc.measures`, `wc.activity`, `wc.workouts`, `wc.sleep`,
  `wc.heart`, `wc.devices`, `wc.goals`, `wc.notify`.
- **Automatic token refresh**: seed the client with tokens and it refreshes them
  proactively before expiry and transparently retries once after a server-side
  auth error. Rotated tokens are surfaced via `onTokenRefresh`.
- **Pagination as async iterators**: `paginate()` on every list resource
  transparently follows the `more`/`offset` cursor.
- **Notify (webhook) API**: `wc.notify.subscribe`/`get`/`list`/`update`/`revoke`,
  plus the `NotifyAppli` category enum.
- **Injectable interfaces** for composability and testability: `TokenStore`
  (pluggable persistence), `Transport` (custom HTTP), and `Clock`.
- **Observability hooks**: `onRequest` / `onResponse` / `onRetry`.
- **Precise typed errors**: `WithingsError` plus `WithingsAuthError`,
  `WithingsRateLimitError` (with `retryAfter`), `WithingsTimeoutError`,
  `WithingsNetworkError`, and `WithingsAbortError`.
- **Resilience**: configurable retries with exponential backoff + full jitter,
  `Retry-After` support, per-request `AbortSignal` timeouts.
- **Opt-in client-side rate limiting**: a token-bucket `RateLimiter`
  (`rateLimit: { requestsPerMinute }`) that keeps you under Withings' 120/min cap
  and avoids `601`s; injectable for custom/distributed strategies.
- **Fully typed response models** for every endpoint (measures, activity, sleep,
  workouts, heart/ECG, devices, goals).
- New endpoints: `activity.intraday`, `sleep.get`, `heart.get` (raw ECG signal).
- **Utilities**: `measureValue` / `realValue` / `findMeasure` (decode Withings'
  `value × 10^unit` measurements) and `parseNotifyEvent` (parse incoming webhook
  payloads into a typed `NotifyEvent`).
- **Status-code catalog**: `describeStatus` / `STATUS_DESCRIPTIONS`; error
  messages are automatically enriched with the human-readable description.
- Exported enums/helpers: `Scope`, `MeasureType`, `NotifyAppli`, `ENDPOINTS`,
  `generateSignature`, `toEpochSeconds`, `toYmd`.
- Flexible date inputs (`Date`, epoch seconds/ms, or ISO/`YYYY-MM-DD` strings).
- Runnable, type-checked `examples/` and generated API docs (`pnpm docs`).

### Changed (breaking)

- Renamed `WithingsNodeOauth2` → `WithingsClient` (a deprecated alias remains
  until v3).
- The API is **namespaced by resource** (`wc.measures.list()` rather than
  `client.getMeasures()`); OAuth lives under `wc.oauth`.
- `getAuthorizeURL(state, scope)` → `wc.oauth.authorizeUrl({ scope, state })`,
  now correctly **URL-encoding** all parameters.
- Data methods now **return the response `body`** and **throw** a typed error on
  a non-zero Withings `status`, instead of resolving `{ status, body }`.
- `getAccessToken` → `wc.oauth.exchangeCode`; `refreshAccessToken` →
  `wc.oauth.refresh`.
- Token-session helpers `setTokens`/`getTokens`/`clearTokens` are now `async`.
- `getUserDevices`/`getUserGoals`/`getUserMeasures`/`getUserActivities`/
  `getUserDailyActivities`/`getUserWorkouts`/`getHeartSummary`/`getSleepSummary`
  moved to their resource namespaces: `wc.devices.list`/`wc.goals.get`/
  `wc.measures.list`/`wc.activity.daily`/`wc.activity.intraday`/
  `wc.workouts.list`/`wc.heart.list`/`wc.sleep.summary`. Access token is now an
  optional per-call option.

### Removed

- The `axios` runtime dependency — the library is now **zero-dependency** and
  uses the native `fetch` (Node.js **20+** required).

### Fixed

- `getAuthorizeURL` no longer produces malformed URLs when scopes or redirect
  URIs contain spaces or special characters, and no longer injects the literal
  string `"null"` for missing `state`/`scope`.
- Nonce failures now throw a real `Error` with a useful message instead of
  `"[object Object]"`.

## [1.0.0] - 2021

- Initial release: OAuth2 flow and data endpoints built on `axios`.

[2.0.0]: https://github.com/desirekaleba/withings-node-oauth2/releases/tag/v2.0.0
[1.0.0]: https://github.com/desirekaleba/withings-node-oauth2/releases/tag/v1.0.0
