import { describe, it, expect } from "vitest";
import { WithingsClient } from "../src/client/client.js";
import { MeasureType, NotifyAppli } from "../src/config/index.js";
import {
  createMockFetch,
  nonceEnvelope,
  routeByAction,
  type CapturedRequest,
  type MockResponseSpec,
} from "./helpers.js";

const creds = {
  clientId: "cid",
  clientSecret: "secret",
  callbackURL: "https://app.example.com/callback",
};

function client(fetchImpl: typeof fetch) {
  return new WithingsClient({
    ...creds,
    fetch: fetchImpl,
    retry: false,
    tokens: { accessToken: "tok", refreshToken: "r" },
  });
}

describe("measures", () => {
  it("posts getmeas to the bare /measure path with mapped params", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getmeas: { json: { status: 0, body: { measuregrps: [] } } },
      }),
    );
    await client(fetch).measures.list({
      types: [MeasureType.Weight, MeasureType.Height],
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-01-02T00:00:00Z"),
    });
    const call = calls[0];
    expect(call.url).toMatch(/wbsapi\.withings\.net\/measure$/);
    expect(call.url).not.toContain("/v2/measure");
    expect(call.params.get("meastypes")).toBe("1,4");
    expect(call.params.get("startdate")).toBe("1704067200");
    expect(call.params.get("enddate")).toBe("1704153600");
    expect(call.headers.authorization).toBe("Bearer tok");
  });

  it("paginates across pages following more/offset", async () => {
    let page = 0;
    const responder = (): MockResponseSpec => {
      page += 1;
      if (page === 1) {
        return {
          json: {
            status: 0,
            body: { measuregrps: [{ grpid: 1 }], more: 1, offset: 10 },
          },
        };
      }
      return {
        json: { status: 0, body: { measuregrps: [{ grpid: 2 }], more: 0 } },
      };
    };
    const { fetch, calls } = createMockFetch(responder);
    const ids: number[] = [];
    for await (const grp of client(fetch).measures.paginate()) {
      ids.push(grp.grpid);
    }
    expect(ids).toEqual([1, 2]);
    expect(calls[1].params.get("offset")).toBe("10");
  });
});

describe("activity", () => {
  it("daily posts getactivity to /v2/measure with a default YMD range", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getactivity: { json: { status: 0, body: { activities: [] } } },
      }),
    );
    await client(fetch).activity.daily();
    expect(calls[0].url).toContain("/v2/measure");
    expect(calls[0].params.get("action")).toBe("getactivity");
    expect(calls[0].params.get("startdateymd")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("intraday posts getintradayactivity with epoch dates", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getintradayactivity: { json: { status: 0, body: { series: {} } } },
      }),
    );
    await client(fetch).activity.intraday({
      from: 1704067200,
      to: new Date("2024-01-02T00:00:00Z"),
    });
    expect(calls[0].params.get("action")).toBe("getintradayactivity");
    expect(calls[0].params.get("startdate")).toBe("1704067200");
    expect(calls[0].params.get("enddate")).toBe("1704153600");
  });
});

describe("workouts / sleep / heart", () => {
  it("workouts.list posts getworkouts to /v2/measure", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getworkouts: { json: { status: 0, body: { series: [] } } },
      }),
    );
    await client(fetch).workouts.list({ from: "2024-01-01", to: "2024-01-31" });
    expect(calls[0].url).toContain("/v2/measure");
    expect(calls[0].params.get("startdateymd")).toBe("2024-01-01");
  });

  it("sleep.summary posts to /v2/sleep and sleep.get uses epoch dates", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getsummary: { json: { status: 0, body: { series: [] } } },
        get: { json: { status: 0, body: { series: [] } } },
      }),
    );
    const c = client(fetch);
    await c.sleep.summary();
    await c.sleep.get({ from: 1704067200, to: 1704153600 });
    expect(calls[0].url).toContain("/v2/sleep");
    expect(calls[0].params.get("action")).toBe("getsummary");
    expect(calls[1].params.get("action")).toBe("get");
    expect(calls[1].params.get("startdate")).toBe("1704067200");
  });

  it("heart.list and heart.get post to /v2/heart", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        list: { json: { status: 0, body: { series: [] } } },
        get: {
          json: {
            status: 0,
            body: { signal: [1, 2], sampling_frequency: 300 },
          },
        },
      }),
    );
    const c = client(fetch);
    await c.heart.list({ from: 1704067200, offset: 5 });
    await c.heart.get({ signalId: 42 });
    expect(calls[0].url).toContain("/v2/heart");
    expect(calls[0].params.get("offset")).toBe("5");
    expect(calls[1].params.get("signalid")).toBe("42");
  });
});

describe("pagination across resources", () => {
  /** A responder that returns two pages, keyed by the body's item field. */
  function twoPages(field: "activities" | "series") {
    let page = 0;
    return (): MockResponseSpec => {
      page += 1;
      const item = { id: page };
      return page === 1
        ? { json: { status: 0, body: { [field]: [item], more: 1, offset: 7 } } }
        : { json: { status: 0, body: { [field]: [item], more: 0 } } };
    };
  }

  it("activity.paginate follows the cursor over `activities`", async () => {
    const { fetch, calls } = createMockFetch(twoPages("activities"));
    const ids: number[] = [];
    for await (const a of client(fetch).activity.paginate()) {
      ids.push((a as unknown as { id: number }).id);
    }
    expect(ids).toEqual([1, 2]);
    expect(calls[1].params.get("offset")).toBe("7");
  });

  it("workouts, sleep and heart paginate over `series`", async () => {
    const runners = [
      (c: WithingsClient) => c.workouts.paginate(),
      (c: WithingsClient) => c.sleep.paginate(),
      (c: WithingsClient) => c.heart.paginate(),
    ];
    for (const run of runners) {
      const { fetch } = createMockFetch(twoPages("series"));
      const ids: number[] = [];
      for await (const item of run(client(fetch))) {
        ids.push((item as unknown as { id: number }).id);
      }
      expect(ids).toEqual([1, 2]);
    }
  });
});

describe("devices / goals", () => {
  it("devices.list posts getdevice to /v2/user", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getdevice: {
          json: { status: 0, body: { devices: [{ type: "Scale" }] } },
        },
      }),
    );
    const body = await client(fetch).devices.list();
    expect(body.devices[0].type).toBe("Scale");
    expect(calls[0].url).toContain("/v2/user");
  });

  it("goals.get posts getgoals", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getgoals: { json: { status: 0, body: { goals: { steps: 10000 } } } },
      }),
    );
    const body = await client(fetch).goals.get();
    expect(body.goals.steps).toBe(10000);
    expect(calls[0].params.get("action")).toBe("getgoals");
  });

  it("goals.get normalizes an empty goals array to an object", async () => {
    // Withings returns `goals: []` for accounts with no goals set.
    const { fetch } = createMockFetch(
      routeByAction({
        getgoals: { json: { status: 0, body: { goals: [] } } },
      }),
    );
    const body = await client(fetch).goals.get();
    expect(Array.isArray(body.goals)).toBe(false);
    expect(body.goals).toEqual({});
  });
});

describe("notify", () => {
  const findAction = (calls: CapturedRequest[], action: string) =>
    calls.find((c) => c.params.get("action") === action)!;

  it("subscribe signs the request and maps camelCase params", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        getnonce: { json: nonceEnvelope },
        subscribe: { json: { status: 0, body: {} } },
      }),
    );
    await client(fetch).notify.subscribe({
      callbackUrl: "https://hooks.example.com/withings",
      appli: NotifyAppli.Sleep,
      comment: "sleep",
    });
    const call = findAction(calls, "subscribe");
    expect(call.url).toMatch(/\/notify$/);
    expect(call.headers.authorization).toBe("Bearer tok");
    expect(call.params.get("callbackurl")).toBe(
      "https://hooks.example.com/withings",
    );
    expect(call.params.get("appli")).toBe(String(NotifyAppli.Sleep));
    expect(call.params.get("nonce")).toBe("nonce-123");
    expect(call.params.get("signature")).toBeTruthy();
  });

  it("list, get, update, revoke map params correctly", async () => {
    const { fetch, calls } = createMockFetch(
      routeByAction({
        list: {
          json: {
            status: 0,
            body: { profiles: [{ appli: 1, callbackurl: "h" }] },
          },
        },
        get: { json: { status: 0, body: { appli: 44, callbackurl: "h" } } },
        update: { json: { status: 0, body: {} } },
        revoke: { json: { status: 0, body: {} } },
      }),
    );
    const c = client(fetch);
    const listed = await c.notify.list({ appli: 1 });
    expect(listed.profiles[0].callbackurl).toBe("h");
    await c.notify.get({ callbackUrl: "h", appli: 44 });
    await c.notify.update({
      callbackUrl: "old",
      appli: 1,
      newCallbackUrl: "new",
      newAppli: 4,
    });
    await c.notify.revoke({ callbackUrl: "h", appli: 1 });
    expect(findAction(calls, "update").params.get("new_callbackurl")).toBe(
      "new",
    );
    expect(findAction(calls, "update").params.get("new_appli")).toBe("4");
    expect(findAction(calls, "revoke").params.get("callbackurl")).toBe("h");
  });
});
