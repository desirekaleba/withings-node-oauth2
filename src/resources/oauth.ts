import { AUTHORIZE_URL } from "../config/index.js";
import type { TokenManager } from "../auth/token-manager.js";
import type {
  AuthorizeUrlOptions,
  ScopeInput,
  Tokens,
} from "../types/index.js";

/** Normalize a scope input to a comma-separated `user.*` string. */
export function formatScope(scope: ScopeInput, raw = false): string {
  const tokens = Array.isArray(scope) ? scope : String(scope).split(",");
  return tokens
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (raw || s.startsWith("user.") ? s : `user.${s}`))
    .join(",");
}

/**
 * The OAuth2 resource: build the authorization URL and exchange/refresh tokens.
 * Token issuance is delegated to the token manager, which persists and
 * de-duplicates refreshes.
 */
export class OAuthResource {
  readonly #clientId: string;
  readonly #callbackURL: string;
  readonly #tokens: TokenManager;

  constructor(clientId: string, callbackURL: string, tokens: TokenManager) {
    this.#clientId = clientId;
    this.#callbackURL = callbackURL;
    this.#tokens = tokens;
  }

  /**
   * Build the URL to redirect a user to in order to authorize your app. All
   * parameters are URL-encoded; bare scope tokens are normalized to `user.*`
   * unless `rawScope` is set.
   */
  authorizeUrl(options: AuthorizeUrlOptions): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.#clientId,
      scope: formatScope(options.scope, options.rawScope),
      redirect_uri: this.#callbackURL,
    });
    if (options.state !== undefined) params.set("state", options.state);
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchange an authorization code for tokens (stored on the client). */
  exchangeCode(code: string, signal?: AbortSignal): Promise<Tokens> {
    return this.#tokens.exchangeCode(code, signal);
  }

  /** Refresh the access token, rotating the refresh token. */
  refresh(refreshToken?: string, signal?: AbortSignal): Promise<Tokens> {
    return this.#tokens.refresh(refreshToken, signal);
  }
}
