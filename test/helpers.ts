import { vi } from "vitest";

export interface CapturedRequest {
  url: string;
  params: URLSearchParams;
  headers: Record<string, string>;
  raw: RequestInit;
}

export interface MockResponseSpec {
  /** HTTP status code. Default `200`. */
  httpStatus?: number;
  /** Full Withings envelope JSON, e.g. `{ status: 0, body: {...} }`. */
  json?: unknown;
  /** Raw text body (overrides `json`). */
  text?: string;
  /** Response headers. */
  headers?: Record<string, string>;
  /** Throw this instead of responding (simulates a network error). */
  throw?: Error;
}

type Responder = (req: CapturedRequest) => MockResponseSpec;

function makeResponse(spec: MockResponseSpec): Response {
  const headers = new Headers(spec.headers ?? {});
  const body =
    spec.text !== undefined ? spec.text : JSON.stringify(spec.json ?? {});
  return {
    status: spec.httpStatus ?? 200,
    headers,
    text: async () => body,
  } as unknown as Response;
}

/**
 * Build a mock `fetch` from a responder function or a fixed queue of specs.
 * Records every call in `.calls`.
 */
export function createMockFetch(
  responderOrQueue: Responder | MockResponseSpec[],
) {
  const calls: CapturedRequest[] = [];
  let index = 0;

  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const body = String(init?.body ?? "");
    const headers = normalizeHeaders(init?.headers);
    const captured: CapturedRequest = {
      url: String(url),
      params: new URLSearchParams(body),
      headers,
      raw: init ?? {},
    };
    calls.push(captured);

    const spec = Array.isArray(responderOrQueue)
      ? (responderOrQueue[index++] ?? { json: { status: 0, body: {} } })
      : responderOrQueue(captured);

    if (spec.throw) throw spec.throw;
    return makeResponse(spec);
  });

  return { fetch: fetchImpl as unknown as typeof fetch, calls };
}

function normalizeHeaders(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (h instanceof Headers) {
    h.forEach((v, k) => (out[k.toLowerCase()] = v));
  } else if (Array.isArray(h)) {
    for (const [k, v] of h) out[k.toLowerCase()] = v;
  } else {
    for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  }
  return out;
}

/** A valid Withings token envelope for tests. */
export function tokenEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    status: 0,
    body: {
      userid: "u123",
      access_token: "access-abc",
      refresh_token: "refresh-xyz",
      scope: "user.activity,user.metrics",
      expires_in: 10800,
      token_type: "Bearer",
      ...overrides,
    },
  };
}

/** A getnonce envelope for tests. */
export const nonceEnvelope = { status: 0, body: { nonce: "nonce-123" } };

/** Route requests by which Withings endpoint they hit. */
export function routeByAction(
  handlers: Record<string, MockResponseSpec>,
): (req: CapturedRequest) => MockResponseSpec {
  return (req) => {
    const action = req.params.get("action") ?? "";
    const spec = handlers[action];
    if (!spec) {
      throw new Error(`No mock handler for action "${action}" at ${req.url}`);
    }
    return spec;
  };
}

/** A controllable clock for deterministic time in tests. */
export function manualClock(start = 1_700_000_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
  };
}
