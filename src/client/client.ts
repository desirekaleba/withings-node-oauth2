import { systemClock } from "../core/clock.js";
import { Dispatcher } from "../core/dispatcher.js";
import { Signer } from "../core/signer.js";
import { FetchTransport } from "../core/transport.js";
import {
  TokenBucketRateLimiter,
  type RateLimiter,
} from "../core/rate-limiter.js";
import { MemoryTokenStore } from "../auth/token-store.js";
import { TokenManager } from "../auth/token-manager.js";
import { WithingsError } from "../core/errors.js";
import type { ResourceContext } from "../resources/base.js";
import { OAuthResource } from "../resources/oauth.js";
import { MeasuresResource } from "../resources/measures.js";
import { ActivityResource } from "../resources/activity.js";
import { WorkoutsResource } from "../resources/workouts.js";
import { SleepResource } from "../resources/sleep.js";
import { HeartResource } from "../resources/heart.js";
import { DevicesResource } from "../resources/devices.js";
import { GoalsResource } from "../resources/goals.js";
import { NotifyResource } from "../resources/notify.js";
import type { Tokens } from "../types/index.js";
import { DEFAULT_RETRY, type WithingsClientOptions } from "./options.js";

export type { WithingsClientOptions } from "./options.js";

/**
 * A modern, fully-typed client for the Withings OAuth2 Health Data & Notify API.
 *
 * The client is a thin composition root: it wires a layered core
 * (`Transport` → `Dispatcher` → `Signer` / `TokenManager`) and exposes the API
 * as independently-testable resource namespaces.
 *
 * @example
 * ```ts
 * const wc = new WithingsClient({ clientId, clientSecret, callbackURL });
 * const url = wc.oauth.authorizeUrl({ scope: [Scope.Activity] });
 * // …redirect, receive `code`…
 * await wc.oauth.exchangeCode(code);
 * const { measuregrps } = await wc.measures.list({ types: [MeasureType.Weight] });
 * for await (const night of wc.sleep.paginate()) console.log(night.data.sleep_score);
 * ```
 */
export class WithingsClient {
  readonly #clientId: string;
  readonly #callbackURL: string;
  readonly #tokenManager: TokenManager;

  /** OAuth2: authorize URL, code exchange, token refresh. */
  readonly oauth: OAuthResource;
  /** Body measurements (weight, blood pressure, temperature…). */
  readonly measures: MeasuresResource;
  /** Physical activity: daily summaries and intraday data. */
  readonly activity: ActivityResource;
  /** Workout sessions. */
  readonly workouts: WorkoutsResource;
  /** Sleep summaries and high-frequency sleep data. */
  readonly sleep: SleepResource;
  /** Heart records: ECG, AFib, blood pressure. */
  readonly heart: HeartResource;
  /** Linked devices. */
  readonly devices: DevicesResource;
  /** User goals. */
  readonly goals: GoalsResource;
  /** Notify (webhook) subscriptions. */
  readonly notify: NotifyResource;

  constructor(options: WithingsClientOptions) {
    if (!options?.clientId || !options?.clientSecret || !options?.callbackURL) {
      throw new WithingsError(
        "WithingsClient requires clientId, clientSecret and callbackURL.",
      );
    }

    this.#clientId = options.clientId;
    this.#callbackURL = options.callbackURL;

    const clock = options.clock ?? systemClock;
    const transport = options.transport ?? new FetchTransport(options.fetch);
    const retry =
      options.retry === false
        ? false
        : { ...DEFAULT_RETRY, ...(options.retry ?? {}) };

    let rateLimiter: RateLimiter | undefined;
    if (options.rateLimit) {
      rateLimiter =
        "acquire" in options.rateLimit
          ? options.rateLimit
          : new TokenBucketRateLimiter(options.rateLimit, clock);
    }

    const dispatcher = new Dispatcher({
      transport,
      clock,
      retry,
      timeoutMs: options.timeoutMs ?? 30_000,
      hooks: options.hooks ?? {},
      rateLimiter,
    });
    const signer = new Signer(
      options.clientId,
      options.clientSecret,
      dispatcher,
      clock,
    );
    const store = options.tokenStore ?? new MemoryTokenStore(options.tokens);

    this.#tokenManager = new TokenManager({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      store,
      signer,
      dispatcher,
      clock,
      onTokenRefresh: options.onTokenRefresh,
      leewaySeconds: options.refreshLeewaySeconds ?? 60,
    });

    const ctx: ResourceContext = {
      dispatcher,
      tokens: this.#tokenManager,
      signer,
    };

    this.oauth = new OAuthResource(
      options.clientId,
      options.callbackURL,
      this.#tokenManager,
    );
    this.measures = new MeasuresResource(ctx);
    this.activity = new ActivityResource(ctx);
    this.workouts = new WorkoutsResource(ctx);
    this.sleep = new SleepResource(ctx);
    this.heart = new HeartResource(ctx);
    this.devices = new DevicesResource(ctx);
    this.goals = new GoalsResource(ctx);
    this.notify = new NotifyResource(ctx);
  }

  /** Withings application client id. */
  get clientId(): string {
    return this.#clientId;
  }

  /** Registered OAuth2 redirect URI. */
  get callbackURL(): string {
    return this.#callbackURL;
  }

  /** Replace the managed token session. */
  setTokens(tokens: Tokens): Promise<void> {
    return Promise.resolve(this.#tokenManager.set(tokens));
  }

  /** Return the current managed tokens, if any. */
  getTokens(): Promise<Tokens | undefined> {
    return Promise.resolve(this.#tokenManager.current());
  }

  /** Clear the managed token session. */
  clearTokens(): Promise<void> {
    return Promise.resolve(this.#tokenManager.clear());
  }
}
