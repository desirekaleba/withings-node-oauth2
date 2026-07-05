import { isRefreshableAuthError } from "../core/errors.js";
import type { Dispatcher } from "../core/dispatcher.js";
import type { Signer } from "../core/signer.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { RequestOptions } from "../types/index.js";

/**
 * Shared collaborators every resource is constructed with.
 * @internal
 */
export interface ResourceContext {
  dispatcher: Dispatcher;
  tokens: TokenManager;
  signer: Signer;
}

/**
 * Base class for API resources. Provides the authenticated request primitive:
 * it resolves the access token (explicit or managed, auto-refreshing a stale
 * managed token) and, when using the managed session, transparently refreshes
 * once and retries after a server-side auth error.
 */
export abstract class Resource {
  protected readonly ctx: ResourceContext;

  constructor(ctx: ResourceContext) {
    this.ctx = ctx;
  }

  /** Make an authenticated request, resolving/refreshing the token as needed. */
  protected async authed<T>(
    url: string,
    params: Record<string, unknown>,
    options: RequestOptions,
  ): Promise<T> {
    const usingManaged = !options.accessToken;
    const accessToken =
      options.accessToken ??
      (await this.ctx.tokens.accessToken(options.signal));

    try {
      return await this.ctx.dispatcher.request<T>(url, params, {
        accessToken,
        signal: options.signal,
      });
    } catch (err) {
      if (usingManaged && isRefreshableAuthError(err)) {
        const refreshed = await this.ctx.tokens.refresh(
          undefined,
          options.signal,
        );
        return this.ctx.dispatcher.request<T>(url, params, {
          accessToken: refreshed.accessToken,
          signal: options.signal,
        });
      }
      throw err;
    }
  }

  /**
   * Make an authenticated request that also carries a nonce + signature
   * (required by the Notify actions).
   */
  protected async signedAuthed<T>(
    url: string,
    action: string,
    params: Record<string, unknown>,
    options: RequestOptions,
  ): Promise<T> {
    const signed = await this.ctx.signer.sign(action, options.signal);
    return this.authed<T>(url, { action, ...params, ...signed }, options);
  }
}
