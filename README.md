<div align="center">

# withings-node-oauth2

**The modern, fully-typed, zero-dependency Node.js client for the [Withings](https://developer.withings.com) OAuth2 Health Data & Notify (webhook) API.**

[![npm version](https://img.shields.io/npm/v/withings-node-oauth2.svg?logo=npm&color=cb3837)](https://www.npmjs.com/package/withings-node-oauth2)
[![npm downloads](https://img.shields.io/npm/dm/withings-node-oauth2.svg?color=blue)](https://www.npmjs.com/package/withings-node-oauth2)
[![CI](https://github.com/desirekaleba/withings-node-oauth2/actions/workflows/ci.yml/badge.svg)](https://github.com/desirekaleba/withings-node-oauth2/actions/workflows/ci.yml)
[![Types](https://img.shields.io/npm/types/withings-node-oauth2.svg?logo=typescript)](https://www.npmjs.com/package/withings-node-oauth2)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/withings-node-oauth2?activeTab=dependencies)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/desirekaleba)

</div>

---

`withings-node-oauth2` handles the tricky parts of the Withings API for you — the
nonce + HMAC signature handshake, OAuth2 token exchange, **automatic token
refresh**, rotating refresh tokens, retries with backoff, rate-limit handling,
pagination, and the Notify (webhook) flow — behind a small, strongly-typed,
namespaced surface. It ships as dual **ESM + CommonJS** with first-class
TypeScript types and **no runtime dependencies** (native `fetch`, Node 20+).

```ts
const wc = new WithingsClient({ clientId, clientSecret, callbackURL });
await wc.oauth.exchangeCode(code);
for await (const night of wc.sleep.paginate()) {
  console.log(night.date, night.data.sleep_score);
}
```

## Features

- 🧭 **Namespaced, resource-oriented API** — `wc.measures`, `wc.sleep`,
  `wc.notify`, … over a clean layered core.
- 🔐 **Full OAuth2 flow** — authorize URL, code exchange, and refresh, with the
  nonce/signature handshake handled automatically.
- ♻️ **Automatic token refresh** — refreshes proactively before expiry and
  transparently after a server-side `401`, persisting rotated tokens.
- 🔁 **Pagination as async iterators** — `for await (… of wc.measures.paginate())`
  transparently follows Withings' `more`/`offset` cursor.
- 🔔 **Notify / webhooks** — subscribe, list, get, update, revoke, with typed
  `appli` categories.
- 🧰 **Precise typed errors** — `WithingsError` + `Auth` / `RateLimit` /
  `Timeout` / `Network` / `Abort` subclasses instead of opaque `{ status }`.
- 🚦 **Resilient by default** — retries transient failures with backoff + jitter,
  honors `Retry-After`, and an opt-in client-side rate limiter to avoid `601`s.
- 🧩 **Composable & testable** — inject a `Transport`, `TokenStore`, or `Clock`;
  observe everything through `onRequest` / `onResponse` / `onRetry` hooks.
- 📈 **Fully typed responses** — real models for measures, activity, sleep,
  workouts, heart/ECG, devices, and goals.
- 🪶 **Zero dependencies** — native `fetch`, ESM + CJS, tree-shakeable.

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Authentication & token management](#authentication--token-management)
- [Resources](#resources)
- [Pagination](#pagination)
- [Notify / webhooks](#notify--webhooks)
- [Error handling](#error-handling)
- [Utilities](#utilities)
- [Configuration](#configuration)
- [Extending: transport, storage, hooks](#extending-transport-storage-hooks)
- [Framework example (Express)](#framework-example-express)
- [Migrating from v1](#migrating-from-v1)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Install

```sh
npm install withings-node-oauth2
# or: pnpm add / yarn add
```

> **Requirements:** Node.js **20+** (uses the built-in `fetch`). Works in ESM
> and CommonJS. You'll need Withings app credentials — see
> [Create your developer account](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/developer-account/create-your-accesses-no-medical-cloud).

## Quick start

```ts
import { WithingsClient, Scope, MeasureType } from "withings-node-oauth2";

const wc = new WithingsClient({
  clientId: process.env.WITHINGS_CLIENT_ID!,
  clientSecret: process.env.WITHINGS_CLIENT_SECRET!,
  callbackURL: process.env.WITHINGS_CALLBACK_URL!,
});

// 1. Send the user to Withings to authorize your app.
const authorizeUrl = wc.oauth.authorizeUrl({
  scope: [Scope.Activity, Scope.Metrics],
  state: "csrf-token",
});

// 2. Withings redirects back to callbackURL with ?code=…&state=…
//    Exchange the code (tokens are stored on the client).
await wc.oauth.exchangeCode(code);

// 3. Call the API. Tokens auto-refresh when they expire.
const { measuregrps } = await wc.measures.list({ types: [MeasureType.Weight] });
const { devices } = await wc.devices.list();
```

<details>
<summary>CommonJS</summary>

```js
const { WithingsClient, Scope } = require("withings-node-oauth2");
```

</details>

## Architecture

The client is a thin **composition root** over a layered core. Each layer has a
single responsibility and is independently testable; each is swappable.

```
WithingsClient (composition root, resource namespaces)
        │
        ├─ Resources        oauth · measures · activity · workouts · sleep ·
        │                    heart · devices · goals · notify
        │                    (map friendly options → Withings params → typed models)
        │
        ├─ TokenManager      exchange · refresh (rotating, deduped) · auto-refresh
        │      └─ TokenStore   pluggable persistence (MemoryTokenStore by default)
        │
        ├─ Signer            nonce fetch + HMAC-SHA256 signature
        │
        └─ Dispatcher        form encoding · Authorization · timeout · retry
               │             (backoff + jitter) · Retry-After · envelope unwrap ·
               │             error classification · lifecycle hooks
               └─ Transport   a single HTTP round-trip (FetchTransport by default)
```

Everything below the resources is exported, so you can compose or replace pieces
(see [Extending](#extending-transport-storage-hooks)).

## Authentication & token management

Two modes, freely mixed:

### Managed session (recommended)

Store tokens on the client and let it refresh them automatically. Provide
`onTokenRefresh` (or a custom [`TokenStore`](#extending-transport-storage-hooks))
to persist rotated tokens — **refresh tokens are single-use and rotate on every
refresh**.

```ts
const wc = new WithingsClient({
  clientId,
  clientSecret,
  callbackURL,
  tokens: {
    accessToken: stored.accessToken,
    refreshToken: stored.refreshToken,
    expiresAt: stored.expiresAt, // ms epoch → enables proactive refresh
  },
  onTokenRefresh: (t) => db.saveTokens(t), // persist rotated tokens
});

const sleep = await wc.sleep.summary(); // token refreshed automatically if stale
```

If Withings rejects a call with an auth error (e.g. the token was revoked
server-side), the client refreshes once and retries transparently.

### Stateless / explicit token

Pass `accessToken` to any resource method to use it directly (no refresh is
attempted for that call):

```ts
await wc.measures.list({ accessToken, types: [1] });
```

Manual control is available too:

```ts
await wc.setTokens({ accessToken, refreshToken });
const fresh = await wc.oauth.refresh(); // rotates + persists
const current = await wc.getTokens();
await wc.clearTokens();
```

## Resources

Every method returns the endpoint's typed **`body`** and throws a typed error on
failure. All accept `{ accessToken?, signal? }` plus endpoint-specific options.
Dates accept a `Date`, epoch seconds/ms, or an ISO / `YYYY-MM-DD` string.

| Namespace     | Methods                                            |
| ------------- | -------------------------------------------------- |
| `wc.oauth`    | `authorizeUrl` · `exchangeCode` · `refresh`        |
| `wc.measures` | `list` · `paginate`                                |
| `wc.activity` | `daily` · `paginate` · `intraday`                  |
| `wc.workouts` | `list` · `paginate`                                |
| `wc.sleep`    | `summary` · `paginate` · `get`                     |
| `wc.heart`    | `list` · `paginate` · `get` (ECG signal)           |
| `wc.devices`  | `list`                                             |
| `wc.goals`    | `get`                                              |
| `wc.notify`   | `subscribe` · `get` · `list` · `update` · `revoke` |

```ts
// Body measurements. `from`/`to` are converted to epoch seconds for you.
const { measuregrps } = await wc.measures.list({
  types: [MeasureType.Weight, MeasureType.FatRatio],
  from: new Date("2024-01-01"),
  to: new Date(),
});

// Daily activity / workouts / sleep default to the last 30 days.
const activity = await wc.activity.daily({ from: "2024-06-01" });
const workouts = await wc.workouts.list();
const nights = await wc.sleep.summary();

// Heart / ECG.
const { series } = await wc.heart.list({ from: 1704067200 });
const ecg = await wc.heart.get({ signalId: series[0].ecg!.signalid });
```

## Pagination

Every list resource exposes `paginate()`, an async iterator that transparently
follows Withings' `more` / `offset` cursor — no manual offset bookkeeping:

```ts
for await (const group of wc.measures.paginate({
  types: [MeasureType.Weight],
})) {
  console.log(group.date, group.measures);
}

// Also: wc.activity.paginate(), wc.workouts.paginate(),
//       wc.sleep.paginate(), wc.heart.paginate()
```

## Notify / webhooks

Subscribe a public HTTPS callback (registered in your app dashboard) to receive
push updates instead of polling. The nonce/signature is handled for you.

```ts
import { NotifyAppli } from "withings-node-oauth2";

await wc.notify.subscribe({
  callbackUrl: "https://hooks.example.com/withings",
  appli: NotifyAppli.Weight,
  comment: "Weigh-ins",
});

const { profiles } = await wc.notify.list();
await wc.notify.revoke({
  callbackUrl: "https://hooks.example.com/withings",
  appli: NotifyAppli.Weight,
});
```

Withings then POSTs `application/x-www-form-urlencoded` events (`userid`,
`appli`, `startdate`, `enddate`) to your callback — typed as `NotifyEvent`.

## Error handling

Every failure throws a `WithingsError` (or a subclass), so you can `catch` one
type and branch precisely:

| Class                    | Thrown when                                                       | Retried?   |
| ------------------------ | ----------------------------------------------------------------- | ---------- |
| `WithingsError`          | Base class / any non-zero Withings `status`.                      | —          |
| `WithingsAuthError`      | Invalid/expired token, signature, nonce, or scope (401/283/342…). | on 283/401 |
| `WithingsRateLimitError` | Withings `601` rate limit (has `retryAfter`).                     | yes        |
| `WithingsTimeoutError`   | Request exceeded `timeoutMs`.                                     | yes        |
| `WithingsNetworkError`   | Transport failure (DNS, reset, offline) — no HTTP response.       | yes        |
| `WithingsAbortError`     | You aborted via your own `AbortSignal`.                           | never      |

```ts
import {
  WithingsError,
  WithingsAuthError,
  WithingsRateLimitError,
} from "withings-node-oauth2";

try {
  await wc.measures.list();
} catch (err) {
  if (err instanceof WithingsRateLimitError) {
    console.log(`Rate limited; retry after ${err.retryAfter}s`);
  } else if (err instanceof WithingsAuthError) {
    // Invalid/expired token, signature, or nonce.
  } else if (err instanceof WithingsError) {
    console.error(err.status, err.httpStatus, err.message);
  }
}
```

The client retries transient failures (HTTP 5xx/429, timeouts, network errors,
and Withings' `601`) automatically with exponential backoff + jitter, honoring
`Retry-After`. Error messages are enriched from a built-in
[status-code catalog](https://developer.withings.com/api-reference/#section/Response-status-codes)
(`describeStatus(code)` is exported too).

### Client-side rate limiting (opt-in)

To stay under Withings' documented **120 requests/minute** cap and avoid `601`s
entirely, enable the built-in token-bucket limiter — requests transparently wait
for a slot instead of failing:

```ts
const wc = new WithingsClient({
  clientId,
  clientSecret,
  callbackURL,
  rateLimit: { requestsPerMinute: 100, burst: 20 }, // or pass a custom RateLimiter
});
```

## Utilities

```ts
import {
  measureValue,
  realValue,
  parseNotifyEvent,
} from "withings-node-oauth2";

// Decode Withings' `value × 10^unit` encoding (e.g. { value: 70500, unit: -3 }).
const { measuregrps } = await wc.measures.list({ types: [MeasureType.Weight] });
const kg = measureValue(measuregrps[0], MeasureType.Weight); // 70.5

// Parse an incoming Notify (webhook) POST body into a typed event.
const event = parseNotifyEvent(req.body); // { userid, appli, startdate, enddate }
```

## Configuration

| Option                 | Type                              | Default   | Description                                      |
| ---------------------- | --------------------------------- | --------- | ------------------------------------------------ |
| `clientId`             | `string`                          | —         | Withings app client id. **Required.**            |
| `clientSecret`         | `string`                          | —         | Withings app client secret. **Required.**        |
| `callbackURL`          | `string`                          | —         | Registered OAuth2 redirect URI. **Required.**    |
| `tokens`               | `Tokens`                          | —         | Seed the default in-memory token store.          |
| `tokenStore`           | `TokenStore`                      | memory    | Pluggable token persistence.                     |
| `onTokenRefresh`       | `(t) => void`                     | —         | Persist tokens after each issue/refresh.         |
| `retry`                | `RetryOptions \| false`           | `2` tries | Backoff + jitter on 5xx/429/601/timeout/network. |
| `rateLimit`            | `RateLimitOptions \| RateLimiter` | off       | Opt-in client-side throttle (token bucket).      |
| `timeoutMs`            | `number`                          | `30000`   | Per-request timeout (via `AbortSignal`).         |
| `refreshLeewaySeconds` | `number`                          | `60`      | Refresh this many seconds before `expiresAt`.    |
| `hooks`                | `Hooks`                           | —         | `onRequest` / `onResponse` / `onRetry`.          |
| `transport`            | `Transport`                       | fetch     | Inject a custom HTTP transport.                  |
| `fetch`                | `typeof fetch`                    | global    | Custom `fetch` for the default transport.        |
| `clock`                | `Clock`                           | system    | Injectable time source (deterministic tests).    |

## Extending: transport, storage, hooks

The core interfaces are exported, so you can adapt the client to your stack.

```ts
import type { TokenStore, Transport, Hooks } from "withings-node-oauth2";

// Persist tokens in Redis.
const tokenStore: TokenStore = {
  get: () => redis.getJSON("withings:tokens"),
  set: (t) => redis.setJSON("withings:tokens", t),
  clear: () => redis.del("withings:tokens"),
};

// Observe every request (logging / tracing / metrics).
const hooks: Hooks = {
  onResponse: ({ url, httpStatus, durationMs }) =>
    logger.info({ url, httpStatus, durationMs }, "withings"),
  onRetry: ({ url, attempt, delayMs }) =>
    logger.warn({ url, attempt, delayMs }, "withings retry"),
};

const wc = new WithingsClient({
  clientId,
  clientSecret,
  callbackURL,
  tokenStore,
  hooks,
});
```

You can also pass a custom `transport` (route through a proxy or a different
HTTP library) or `clock` (deterministic time in tests).

## Framework example (Express)

```ts
import express from "express";
import { WithingsClient, Scope } from "withings-node-oauth2";

const app = express();
const wc = new WithingsClient({
  clientId: process.env.WITHINGS_CLIENT_ID!,
  clientSecret: process.env.WITHINGS_CLIENT_SECRET!,
  callbackURL: process.env.WITHINGS_CALLBACK_URL!,
  onTokenRefresh: (t) => saveTokensToDb(t),
});

app.get("/authorize", (_req, res) => {
  res.redirect(wc.oauth.authorizeUrl({ scope: [Scope.Info, Scope.Activity] }));
});

app.get("/callback", async (req, res, next) => {
  try {
    const tokens = await wc.oauth.exchangeCode(String(req.query.code));
    res.json({ userId: tokens.userId });
  } catch (err) {
    next(err);
  }
});

app.get("/activity", async (_req, res, next) => {
  try {
    res.json(await wc.activity.daily());
  } catch (err) {
    next(err);
  }
});

app.listen(3000);
```

## Migrating from v1

v2 is a ground-up TypeScript rewrite with a namespaced, resource-oriented API.

| v1                                           | v2                                                |
| -------------------------------------------- | ------------------------------------------------- |
| `new WithingsNodeOauth2({ … })`              | `new WithingsClient({ … })` (old name aliased)    |
| `getAuthorizeURL(state, scope)`              | `wc.oauth.authorizeUrl({ scope, state })`         |
| `getAccessToken(code)` → `{ status, body }`  | `wc.oauth.exchangeCode(code)` → `Tokens` (throws) |
| `refreshAccessToken(token)`                  | `wc.oauth.refresh(token?)`                        |
| `getUserDevices(accessToken)`                | `wc.devices.list({ accessToken? })`               |
| `getUserMeasures(accessToken, opts)`         | `wc.measures.list({ accessToken?, ...opts })`     |
| `getUserActivities` / `getUserWorkouts`      | `wc.activity.daily` / `wc.workouts.list`          |
| `getSleepSummary` / `getUserDailyActivities` | `wc.sleep.summary` / `wc.activity.intraday`       |
| `getHeartSummary`                            | `wc.heart.list`                                   |
| Check `result.status === 0` manually         | Non-zero status throws a typed `WithingsError`    |
| `axios` dependency                           | Zero dependencies (native `fetch`, Node 20+)      |

**Breaking changes to note:**

1. The API is **namespaced** (`wc.measures.list()` instead of `client.getMeasures()`).
2. Methods **return the `body`** and **throw** typed errors on non-zero status.
3. `authorizeUrl` takes an options object and correctly URL-encodes everything
   (v1 produced broken URLs with spaces/special chars and injected the literal
   `"null"`).
4. Token-session helpers (`setTokens`/`getTokens`/`clearTokens`) are now `async`
   (they support async `TokenStore`s).

The deprecated `WithingsNodeOauth2` alias is exported for a soft landing and is
removed in v3.

## Examples & API docs

Runnable, type-checked examples live in [`examples/`](./examples): focused ones
for the OAuth flow (Express), webhooks, pagination, and a Redis-backed
`TokenStore` — plus a **[live dashboard](./examples/dashboard.ts)** that exercises
_everything_ in one page.

**Try it live in ~2 minutes:** copy [`.env.example`](./.env.example) to `.env`
with your Withings app credentials, then:

```sh
pnpm build && npx tsx examples/dashboard.ts   # open http://localhost:3000 → Connect
```

You'll see the OAuth flow, every data resource, pagination, token refresh, and
the utilities all light up as live calls to Withings. Generate the full API
reference from source with `pnpm docs` (typedoc).

## Contributing

Issues and PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md), the
[code of conduct](./CODE_OF_CONDUCT.md), and the [security policy](./SECURITY.md).
Run `pnpm check` before opening a PR.

## Support

If this package saved you time, you can
[**buy me a coffee**](https://www.buymeacoffee.com/desirekaleba) ☕ — it's
appreciated and helps keep the library maintained. Starring the repo helps too.

## License

[MIT](./LICENSE) © Desire Kaleba
