import { describe, it, expect, vi } from "vitest";
import { Dispatcher } from "../src/core/dispatcher.js";
import { FetchTransport } from "../src/core/transport.js";
import {
  WithingsAbortError,
  WithingsAuthError,
  WithingsError,
  WithingsNetworkError,
  WithingsRateLimitError,
  WithingsTimeoutError,
} from "../src/core/errors.js";
import type { Hooks, RetryPolicy } from "../src/types/index.js";
import { createMockFetch, manualClock } from "./helpers.js";

const fastRetry: RetryPolicy = {
  retries: 3,
  minTimeoutMs: 1,
  maxTimeoutMs: 2,
};

function makeDispatcher(
  fetchImpl: typeof fetch,
  opts: { retry?: RetryPolicy | false; hooks?: Hooks; timeoutMs?: number } = {},
) {
  return new Dispatcher({
    transport: new FetchTransport(fetchImpl),
    clock: manualClock(),
    retry: opts.retry ?? fastRetry,
    timeoutMs: opts.timeoutMs ?? 1000,
    hooks: opts.hooks ?? {},
  });
}

describe("Dispatcher", () => {
  it("returns the body on status 0", async () => {
    const { fetch } = createMockFetch([
      { json: { status: 0, body: { ok: true } } },
    ]);
    const body = await makeDispatcher(fetch).request<{ ok: boolean }>(
      "https://x/y",
      {},
    );
    expect(body.ok).toBe(true);
  });

  it("returns an empty object when body is absent", async () => {
    const { fetch } = createMockFetch([{ json: { status: 0 } }]);
    expect(await makeDispatcher(fetch).request("https://x/y", {})).toEqual({});
  });

  it("attaches the bearer token, content type, and omits null params", async () => {
    const { fetch, calls } = createMockFetch([
      { json: { status: 0, body: {} } },
    ]);
    await makeDispatcher(fetch).request(
      "https://x/y",
      { a: 1, b: undefined, c: null },
      { accessToken: "t" },
    );
    expect(calls[0].headers.authorization).toBe("Bearer t");
    expect(calls[0].headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(calls[0].params.get("a")).toBe("1");
    expect(calls[0].params.has("b")).toBe(false);
    expect(calls[0].params.has("c")).toBe(false);
  });

  it("classifies auth status codes as WithingsAuthError (no retry)", async () => {
    const { fetch, calls } = createMockFetch(() => ({
      json: { status: 401, error: "bad token" },
    }));
    await expect(
      makeDispatcher(fetch).request("https://x/y", {}),
    ).rejects.toBeInstanceOf(WithingsAuthError);
    expect(calls.length).toBe(1);
  });

  it("enriches the error message with the status-code catalog", async () => {
    // No `error` field → the message is synthesized with the code description.
    const { fetch } = createMockFetch(() => ({ json: { status: 342 } }));
    const err = (await makeDispatcher(fetch, { retry: false })
      .request("https://x/y", {})
      .catch((e) => e)) as WithingsError;
    expect(err).toBeInstanceOf(WithingsAuthError);
    expect(err.status).toBe(342);
    expect(err.message).toMatch(/signature|nonce/i);
  });

  it("retries status 601 and surfaces WithingsRateLimitError with retryAfter", async () => {
    const { fetch, calls } = createMockFetch(() => ({
      json: { status: 601, error: "too many requests" },
      headers: { "retry-after": "0" },
    }));
    const err = await makeDispatcher(fetch)
      .request("https://x/y", {})
      .catch((e) => e);
    expect(err).toBeInstanceOf(WithingsRateLimitError);
    expect((err as WithingsRateLimitError).retryAfter).toBe(0);
    expect(calls.length).toBe(4); // initial + 3 retries
  });

  it("retries HTTP 5xx then succeeds", async () => {
    let n = 0;
    const { fetch, calls } = createMockFetch(() => {
      n += 1;
      return n < 3
        ? { httpStatus: 503, json: {} }
        : { httpStatus: 200, json: { status: 0, body: { ok: 1 } } };
    });
    const body = await makeDispatcher(fetch).request<{ ok: number }>(
      "https://x/y",
      {},
    );
    expect(body.ok).toBe(1);
    expect(calls.length).toBe(3);
  });

  it("retries network errors then succeeds", async () => {
    let n = 0;
    const { fetch } = createMockFetch(() => {
      n += 1;
      return n < 2
        ? { throw: new TypeError("network down") }
        : { json: { status: 0, body: { ok: 1 } } };
    });
    const body = await makeDispatcher(fetch).request<{ ok: number }>(
      "https://x/y",
      {},
    );
    expect(body.ok).toBe(1);
  });

  it("wraps a non-JSON response in a WithingsError", async () => {
    const { fetch } = createMockFetch([
      { httpStatus: 200, text: "<html>oops</html>" },
    ]);
    await expect(
      makeDispatcher(fetch, { retry: false }).request("https://x/y", {}),
    ).rejects.toThrow(/non-JSON/);
  });

  it("classifies a caller abort as WithingsAbortError (no retry)", async () => {
    const controller = new AbortController();
    const { fetch, calls } = createMockFetch(() => {
      controller.abort();
      return { throw: new DOMException("aborted", "AbortError") };
    });
    const err = await makeDispatcher(fetch)
      .request("https://x/y", {}, { signal: controller.signal })
      .catch((e) => e);
    expect(err).toBeInstanceOf(WithingsAbortError);
    expect(calls.length).toBe(1);
  });

  it("short-circuits an already-aborted signal without calling the transport", async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetch, calls } = createMockFetch(() => ({
      json: { status: 0, body: {} },
    }));
    const err = await makeDispatcher(fetch)
      .request("https://x/y", {}, { signal: controller.signal })
      .catch((e) => e);
    expect(err).toBeInstanceOf(WithingsAbortError);
    expect(calls.length).toBe(0); // transport never touched
  });

  it("classifies a network failure as WithingsNetworkError", async () => {
    const { fetch } = createMockFetch(() => ({ throw: new TypeError("boom") }));
    const err = await makeDispatcher(fetch, { retry: false })
      .request("https://x/y", {})
      .catch((e) => e);
    expect(err).toBeInstanceOf(WithingsNetworkError);
    expect(err).toBeInstanceOf(WithingsError);
  });

  it("classifies its own timeout as WithingsTimeoutError (retryable)", async () => {
    let attempts = 0;
    // A fetch that never resolves until its signal aborts.
    const hangingFetch = ((_url: string, init: RequestInit) => {
      attempts += 1;
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    }) as unknown as typeof fetch;
    const err = await makeDispatcher(hangingFetch, {
      timeoutMs: 10,
      retry: { retries: 1, minTimeoutMs: 1, maxTimeoutMs: 1 },
    })
      .request("https://x/y", {})
      .catch((e) => e);
    expect(err).toBeInstanceOf(WithingsTimeoutError);
    expect(attempts).toBe(2); // initial + 1 retry
  });

  it("performs exactly one attempt when retry is disabled", async () => {
    const { fetch, calls } = createMockFetch(() => ({
      throw: new TypeError("boom"),
    }));
    await expect(
      makeDispatcher(fetch, { retry: false }).request("https://x/y", {}),
    ).rejects.toBeInstanceOf(WithingsError);
    expect(calls.length).toBe(1);
  });

  it("fires lifecycle hooks and never lets a throwing hook break the request", async () => {
    const onRequest = vi.fn(() => {
      throw new Error("hook boom");
    });
    const onResponse = vi.fn();
    const onRetry = vi.fn();
    let n = 0;
    const { fetch } = createMockFetch(() => {
      n += 1;
      return n < 2
        ? { httpStatus: 503, json: {} }
        : { json: { status: 0, body: { ok: 1 } } };
    });
    const body = await makeDispatcher(fetch, {
      hooks: { onRequest, onResponse, onRetry },
    }).request<{ ok: number }>("https://x/y", {});
    expect(body.ok).toBe(1);
    expect(onRequest).toHaveBeenCalledTimes(2); // one per attempt
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalled();
  });
});
