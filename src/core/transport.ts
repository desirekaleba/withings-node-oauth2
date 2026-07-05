/**
 * The transport layer: how a single HTTP round-trip is performed. It knows
 * nothing about Withings semantics (envelopes, signing, retries) — that lives
 * in the {@link Dispatcher}. Swap it to route through a proxy, a different HTTP
 * library, or a recorded fixture.
 */

/** The subset of `RequestInit` the dispatcher provides to a transport. */
export interface TransportRequest {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

/** The subset of `Response` the dispatcher consumes from a transport. */
export interface TransportResponse {
  status: number;
  headers: Headers;
  text(): Promise<string>;
}

/** Performs a single HTTP request. */
export interface Transport {
  request(url: string, init: TransportRequest): Promise<TransportResponse>;
}

/**
 * The default {@link Transport}, backed by the global `fetch` (Node 18+). A
 * `Response` structurally satisfies {@link TransportResponse}, so it is returned
 * as-is.
 */
export class FetchTransport implements Transport {
  readonly #fetch: typeof fetch;

  constructor(fetchImpl: typeof fetch = globalThis.fetch) {
    if (typeof fetchImpl !== "function") {
      throw new TypeError(
        "Global fetch is unavailable. Use Node 18+ or pass a `fetch` implementation.",
      );
    }
    this.#fetch = fetchImpl;
  }

  request(url: string, init: TransportRequest): Promise<TransportResponse> {
    return this.#fetch(url, init);
  }
}
