import { ENDPOINTS } from "../config/index.js";
import { WithingsAuthError } from "../core/errors.js";
import type { Clock } from "../core/clock.js";
import type { Dispatcher } from "../core/dispatcher.js";
import type { Signer } from "../core/signer.js";
import type { Awaitable, RawTokenBody, Tokens } from "../types/index.js";
import type { TokenStore } from "./token-store.js";

export interface TokenManagerConfig {
  clientId: string;
  clientSecret: string;
  callbackURL: string;
  store: TokenStore;
  signer: Signer;
  dispatcher: Dispatcher;
  clock: Clock;
  onTokenRefresh?: (tokens: Tokens) => Awaitable<void>;
  /** Seconds of leeway before `expiresAt` at which a token is refreshed. */
  leewaySeconds: number;
}

/**
 * Owns the token lifecycle: exchanging an auth code, refreshing (with rotating
 * refresh tokens), proactively refreshing stale access tokens, de-duplicating
 * concurrent refreshes, and persisting through the {@link TokenStore} and the
 * `onTokenRefresh` callback.
 */
export class TokenManager {
  readonly #cfg: TokenManagerConfig;
  #inflight?: Promise<Tokens>;

  constructor(config: TokenManagerConfig) {
    this.#cfg = config;
  }

  /** Exchange an authorization code for tokens and persist them. */
  async exchangeCode(code: string, signal?: AbortSignal): Promise<Tokens> {
    const signed = await this.#cfg.signer.sign("requesttoken", signal);
    const body = await this.#cfg.dispatcher.request<RawTokenBody>(
      ENDPOINTS.oauth2,
      {
        action: "requesttoken",
        grant_type: "authorization_code",
        client_secret: this.#cfg.clientSecret,
        code,
        redirect_uri: this.#cfg.callbackURL,
        ...signed,
      },
      { signal },
    );
    return this.#persist(body);
  }

  /**
   * Refresh the access token. Uses the stored refresh token when none is given.
   * Managed refreshes are de-duplicated so concurrent callers share one round
   * trip.
   */
  async refresh(refreshToken?: string, signal?: AbortSignal): Promise<Tokens> {
    if (refreshToken) return this.#doRefresh(refreshToken, signal);
    if (this.#inflight) return this.#inflight;

    const run = (async () => {
      const stored = await this.#cfg.store.get();
      const token = stored?.refreshToken;
      if (!token) {
        throw new WithingsAuthError(
          "No refresh token available. Provide one or set tokens first.",
        );
      }
      return this.#doRefresh(token, signal);
    })();

    this.#inflight = run;
    try {
      return await run;
    } finally {
      this.#inflight = undefined;
    }
  }

  /** Resolve an access token to use, refreshing a stale managed token first. */
  async accessToken(signal?: AbortSignal): Promise<string> {
    const tokens = await this.#cfg.store.get();
    if (!tokens?.accessToken) {
      throw new WithingsAuthError(
        "No access token available. Pass `accessToken` or authenticate first.",
      );
    }
    const leewayMs = this.#cfg.leewaySeconds * 1000;
    if (
      tokens.expiresAt !== undefined &&
      tokens.refreshToken &&
      this.#cfg.clock.now() >= tokens.expiresAt - leewayMs
    ) {
      const refreshed = await this.refresh(undefined, signal);
      return refreshed.accessToken;
    }
    return tokens.accessToken;
  }

  /** Return the current tokens, if any. */
  current(): Awaitable<Tokens | undefined> {
    return this.#cfg.store.get();
  }

  /** Replace the stored tokens. */
  async set(tokens: Tokens): Promise<void> {
    await this.#cfg.store.set(tokens);
  }

  /** Clear the stored tokens. */
  async clear(): Promise<void> {
    await this.#cfg.store.clear();
  }

  async #doRefresh(
    refreshToken: string,
    signal?: AbortSignal,
  ): Promise<Tokens> {
    const signed = await this.#cfg.signer.sign("requesttoken", signal);
    const body = await this.#cfg.dispatcher.request<RawTokenBody>(
      ENDPOINTS.oauth2,
      {
        action: "requesttoken",
        grant_type: "refresh_token",
        client_secret: this.#cfg.clientSecret,
        refresh_token: refreshToken,
        ...signed,
      },
      { signal },
    );
    return this.#persist(body);
  }

  async #persist(body: RawTokenBody): Promise<Tokens> {
    const tokens: Tokens = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      userId: body.userid,
      scope: body.scope,
      expiresAt: this.#cfg.clock.now() + Number(body.expires_in) * 1000,
    };
    await this.#cfg.store.set(tokens);
    if (this.#cfg.onTokenRefresh) {
      // Persistence errors are surfaced; keep them from masking the tokens.
      await this.#cfg.onTokenRefresh(tokens);
    }
    return tokens;
  }
}
