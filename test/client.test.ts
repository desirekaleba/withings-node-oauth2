import { describe, it, expect, vi } from "vitest";
import { WithingsClient } from "../src/client/client.js";
import { MemoryTokenStore } from "../src/auth/token-store.js";
import { WithingsAuthError } from "../src/core/errors.js";
import type { MockResponseSpec } from "./helpers.js";
import {
  createMockFetch,
  manualClock,
  nonceEnvelope,
  routeByAction,
  tokenEnvelope,
} from "./helpers.js";

const creds = {
  clientId: "cid",
  clientSecret: "secret",
  callbackURL: "https://app.example.com/callback",
};

function makeClient(
  fetchImpl: typeof fetch,
  extra: Record<string, unknown> = {},
) {
  return new WithingsClient({
    ...creds,
    fetch: fetchImpl,
    retry: false,
    ...extra,
  });
}

describe("constructor", () => {
  it("throws when required credentials are missing", () => {
    // @ts-expect-error intentionally invalid
    expect(() => new WithingsClient({ clientId: "x" })).toThrow(/requires/);
  });

  it("throws when the provided fetch is not callable", () => {
    expect(
      () =>
        new WithingsClient({
          ...creds,
          fetch: null as unknown as typeof fetch,
        }),
    ).toThrow(/fetch is unavailable/);
  });
});

describe("oauth.authorizeUrl", () => {
  it("URL-encodes params and normalizes bare scopes", () => {
    const client = makeClient(createMockFetch([]).fetch);
    const url = new URL(
      client.oauth.authorizeUrl({
        scope: ["activity", "metrics"],
        state: "a b&c",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://account.withings.com/oauth2_user/authorize2",
    );
    expect(url.searchParams.get("scope")).toBe("user.activity,user.metrics");
    expect(url.searchParams.get("redirect_uri")).toBe(creds.callbackURL);
    expect(url.searchParams.get("state")).toBe("a b&c");
    expect(url.href).not.toContain("null");
  });

  it("supports comma strings, existing prefixes, rawScope, and omitted state", () => {
    const client = makeClient(createMockFetch([]).fetch);
    expect(
      new URL(
        client.oauth.authorizeUrl({ scope: "user.info, activity" }),
      ).searchParams.get("scope"),
    ).toBe("user.info,user.activity");
    const raw = new URL(
      client.oauth.authorizeUrl({ scope: "custom.scope", rawScope: true }),
    );
    expect(raw.searchParams.get("scope")).toBe("custom.scope");
    expect(raw.searchParams.has("state")).toBe(false);
  });
});

describe("oauth token flow", () => {
  it("exchangeCode fetches a nonce, signs, and persists tokens", async () => {
    const onTokenRefresh = vi.fn();
    const clock = manualClock();
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getnonce: { json: nonceEnvelope },
        requesttoken: { json: tokenEnvelope() },
      }),
    );
    const client = makeClient(fetch, { onTokenRefresh, clock });
    const tokens = await client.oauth.exchangeCode("auth-code");

    expect(tokens.accessToken).toBe("access-abc");
    expect(tokens.expiresAt).toBe(clock.now() + 10800 * 1000);
    expect(calls[0].url).toContain("/v2/signature");
    const tokenCall = calls[1];
    expect(tokenCall.url).toContain("/v2/oauth2");
    expect(tokenCall.params.get("grant_type")).toBe("authorization_code");
    expect(tokenCall.params.get("nonce")).toBe("nonce-123");
    expect(tokenCall.params.get("signature")).toBeTruthy();
    expect(onTokenRefresh).toHaveBeenCalledOnce();
    expect((await client.getTokens())?.accessToken).toBe("access-abc");
  });

  it("refresh uses the managed token, rotates it, and dedupes concurrent calls", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getnonce: { json: nonceEnvelope },
        requesttoken: {
          json: tokenEnvelope({ access_token: "a2", refresh_token: "r2" }),
        },
      }),
    );
    const client = makeClient(fetch, {
      tokens: { accessToken: "old", refreshToken: "r1" },
    });
    const [a, b] = await Promise.all([
      client.oauth.refresh(),
      client.oauth.refresh(),
    ]);
    expect(a.accessToken).toBe("a2");
    expect(a.refreshToken).toBe("r2");
    expect(b).toEqual(a);
    expect(calls.filter((c) => c.url.includes("/v2/oauth2")).length).toBe(1);
    const tokenCall = calls.find((c) => c.url.includes("/v2/oauth2"))!;
    expect(tokenCall.params.get("refresh_token")).toBe("r1");
  });

  it("refresh throws WithingsAuthError with no refresh token", async () => {
    const client = makeClient(createMockFetch([]).fetch);
    await expect(client.oauth.refresh()).rejects.toBeInstanceOf(
      WithingsAuthError,
    );
  });
});

describe("auto token refresh", () => {
  it("refreshes proactively when the managed token is expired", async () => {
    const clock = manualClock();
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getnonce: { json: nonceEnvelope },
        requesttoken: { json: tokenEnvelope({ access_token: "renewed" }) },
        getdevice: { json: { status: 0, body: { devices: [] } } },
      }),
    );
    const client = makeClient(fetch, {
      clock,
      tokens: {
        accessToken: "stale",
        refreshToken: "r1",
        expiresAt: clock.now() - 1000,
      },
    });
    await client.devices.list();
    const deviceCall = calls.find((c) => c.url.includes("/v2/user"))!;
    expect(deviceCall.headers.authorization).toBe("Bearer renewed");
  });

  it("retries once after a server-side auth error by refreshing", async () => {
    let deviceCalls = 0;
    const responder = (req: { params: URLSearchParams }): MockResponseSpec => {
      const action = req.params.get("action");
      if (action === "getnonce") return { json: nonceEnvelope };
      if (action === "requesttoken")
        return { json: tokenEnvelope({ access_token: "recovered" }) };
      if (action === "getdevice") {
        deviceCalls += 1;
        return deviceCalls === 1
          ? { json: { status: 401, error: "invalid token" } }
          : { json: { status: 0, body: { devices: [] } } };
      }
      throw new Error(`unexpected ${action}`);
    };
    const { fetch, calls } = createMockFetch(responder);
    const client = makeClient(fetch, {
      tokens: {
        accessToken: "revoked",
        refreshToken: "r1",
        expiresAt: manualClock().now() + 3_600_000,
      },
      clock: manualClock(),
    });
    await client.devices.list();
    expect(deviceCalls).toBe(2);
    expect(
      calls.filter((c) => c.url.includes("/v2/user")).at(-1)!.headers
        .authorization,
    ).toBe("Bearer recovered");
  });

  it("does not auto-refresh when an explicit accessToken is supplied", async () => {
    const { fetch } = createMockFetch(
      routeByAction({
        getdevice: { json: { status: 401, error: "invalid token" } },
      }),
    );
    const client = makeClient(fetch, {
      tokens: { accessToken: "managed", refreshToken: "r1" },
    });
    await expect(
      client.devices.list({ accessToken: "explicit" }),
    ).rejects.toBeInstanceOf(WithingsAuthError);
  });

  it("does not refresh on a non-token auth error (e.g. scope 214)", async () => {
    const responder = (req: { params: URLSearchParams }): MockResponseSpec => {
      if (req.params.get("action") === "getdevice") {
        return { json: { status: 214, error: "not authorized" } };
      }
      throw new Error("no refresh (getnonce/requesttoken) should be attempted");
    };
    const { fetch, calls } = createMockFetch(responder);
    const client = makeClient(fetch, {
      tokens: { accessToken: "t", refreshToken: "r1" },
    });
    await expect(client.devices.list()).rejects.toBeInstanceOf(
      WithingsAuthError,
    );
    // A single attempt: scope errors are not retried by refreshing.
    expect(calls.length).toBe(1);
    expect(calls[0].params.get("action")).toBe("getdevice");
  });

  it("throws when no token is available", async () => {
    const client = makeClient(createMockFetch([]).fetch);
    await expect(client.devices.list()).rejects.toBeInstanceOf(
      WithingsAuthError,
    );
  });
});

describe("injectable interfaces", () => {
  it("uses a custom TokenStore for persistence", async () => {
    const store = new MemoryTokenStore();
    const setSpy = vi.spyOn(store, "set");
    const { fetch } = createMockFetch(
      routeByAction({
        getnonce: { json: nonceEnvelope },
        requesttoken: { json: tokenEnvelope() },
      }),
    );
    const client = makeClient(fetch, { tokenStore: store });
    await client.oauth.exchangeCode("code");
    expect(setSpy).toHaveBeenCalledOnce();
    expect(store.get()?.accessToken).toBe("access-abc");
  });

  it("routes requests through a custom Transport", async () => {
    const requests: string[] = [];
    const transport = {
      request: async (url: string, init: { body: string }) => {
        requests.push(url);
        void init;
        return {
          status: 200,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({ status: 0, body: { devices: [] } }),
        };
      },
    };
    const client = new WithingsClient({
      ...creds,
      transport,
      retry: false,
      tokens: { accessToken: "t", refreshToken: "r" },
    });
    await client.devices.list();
    expect(requests[0]).toContain("/v2/user");
  });

  it("wires hooks through to the dispatcher", async () => {
    const onResponse = vi.fn();
    const { fetch } = createMockFetch(
      routeByAction({
        getdevice: { json: { status: 0, body: { devices: [] } } },
      }),
    );
    const client = makeClient(fetch, { hooks: { onResponse } });
    await client.devices.list({ accessToken: "t" });
    expect(onResponse).toHaveBeenCalledOnce();
  });

  it("gates requests through a custom RateLimiter", async () => {
    const acquire = vi.fn(() => Promise.resolve());
    const { fetch } = createMockFetch(
      routeByAction({
        getdevice: { json: { status: 0, body: { devices: [] } } },
      }),
    );
    const client = makeClient(fetch, { rateLimit: { acquire } });
    await client.devices.list({ accessToken: "t" });
    expect(acquire).toHaveBeenCalledOnce();
  });

  it("builds a token-bucket limiter from rateLimit options", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getdevice: { json: { status: 0, body: { devices: [] } } },
      }),
    );
    const client = makeClient(fetch, {
      rateLimit: { requestsPerMinute: 120 },
    });
    // A generous limit doesn't block the first requests.
    await client.devices.list({ accessToken: "t" });
    await client.devices.list({ accessToken: "t" });
    expect(calls.length).toBe(2);
  });
});

describe("token session helpers", () => {
  it("sets, reads, and clears tokens", async () => {
    const client = makeClient(createMockFetch([]).fetch);
    await client.setTokens({ accessToken: "a", refreshToken: "b" });
    expect(await client.getTokens()).toEqual({
      accessToken: "a",
      refreshToken: "b",
    });
    await client.clearTokens();
    expect(await client.getTokens()).toBeUndefined();
  });

  it("exposes clientId and callbackURL", () => {
    const client = makeClient(createMockFetch([]).fetch);
    expect(client.clientId).toBe("cid");
    expect(client.callbackURL).toBe(creds.callbackURL);
  });
});
