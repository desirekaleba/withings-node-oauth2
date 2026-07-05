import { ENDPOINTS } from "../config/index.js";
import { generateSignature } from "./crypto.js";
import type { Clock } from "./clock.js";
import type { Dispatcher } from "./dispatcher.js";

/** The signed credential triplet appended to signed Withings actions. */
export interface SignedParams {
  client_id: string;
  nonce: string;
  signature: string;
}

/**
 * Handles the Withings nonce + HMAC-SHA256 signature handshake required by
 * OAuth token and Notify actions. It fetches a fresh, single-use nonce and
 * signs the target action with the client secret.
 */
export class Signer {
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #dispatcher: Dispatcher;
  readonly #clock: Clock;

  constructor(
    clientId: string,
    clientSecret: string,
    dispatcher: Dispatcher,
    clock: Clock,
  ) {
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
    this.#dispatcher = dispatcher;
    this.#clock = clock;
  }

  /** Fetch a nonce and build the signed params for `action`. */
  async sign(action: string, signal?: AbortSignal): Promise<SignedParams> {
    const timestamp = Math.floor(this.#clock.now() / 1000);
    const { nonce } = await this.#dispatcher.request<{ nonce: string }>(
      ENDPOINTS.signature,
      {
        action: "getnonce",
        client_id: this.#clientId,
        timestamp,
        signature: generateSignature(
          "getnonce",
          this.#clientId,
          this.#clientSecret,
          timestamp,
        ),
      },
      { signal },
    );
    return {
      client_id: this.#clientId,
      nonce,
      signature: generateSignature(
        action,
        this.#clientId,
        this.#clientSecret,
        nonce,
      ),
    };
  }
}
