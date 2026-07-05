import type { Awaitable, Tokens } from "../types/index.js";

/**
 * Pluggable persistence for the managed token session. Implement this to back
 * tokens with Redis, a database, encrypted storage, etc. All methods may be
 * synchronous or asynchronous.
 */
export interface TokenStore {
  /** Load the current tokens, or `undefined` if none are stored. */
  get(): Awaitable<Tokens | undefined>;
  /** Persist tokens (called after every issue/refresh). */
  set(tokens: Tokens): Awaitable<void>;
  /** Remove any stored tokens. */
  clear(): Awaitable<void>;
}

/** The default in-process {@link TokenStore}. */
export class MemoryTokenStore implements TokenStore {
  #tokens?: Tokens;

  constructor(initial?: Tokens) {
    this.#tokens = initial;
  }

  get(): Tokens | undefined {
    return this.#tokens;
  }

  set(tokens: Tokens): void {
    this.#tokens = tokens;
  }

  clear(): void {
    this.#tokens = undefined;
  }
}
