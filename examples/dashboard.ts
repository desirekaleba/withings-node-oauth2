/**
 * Live playground — run this, click "Connect", and watch every feature of the
 * client work against the real Withings API in one browser page: the OAuth
 * flow, every data resource, pagination, an injectable file-backed TokenStore,
 * retry + rate-limit + observability hooks, typed errors, and the utilities.
 *
 * Setup:
 *   1. Copy .env.example to .env and fill in your Withings app credentials.
 *   2. `npm i -g tsx` (once), then from a project that has the package installed
 *      run `tsx dashboard.ts` — or, from this repo, `pnpm build && tsx examples/dashboard.ts`.
 *   3. Open http://localhost:3000 and click "Connect with Withings".
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import {
  WithingsClient,
  WithingsError,
  Scope,
  MeasureType,
  measureValue,
  realValue,
  describeStatus,
  parseNotifyEvent,
  type TokenStore,
  type Tokens,
} from "withings-node-oauth2";

const PORT = 3000;
const TOKENS_FILE = new URL("./.tokens.json", import.meta.url);

// --- Injectable, file-backed TokenStore (persists the session across restarts) ---
const fileTokenStore: TokenStore = {
  get(): Tokens | undefined {
    try {
      return JSON.parse(readFileSync(TOKENS_FILE, "utf8")) as Tokens;
    } catch {
      return undefined;
    }
  },
  set(tokens: Tokens): void {
    writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
  },
  clear(): void {
    try {
      unlinkSync(TOKENS_FILE);
    } catch {
      /* nothing to clear */
    }
  },
};

const action = (url: string): string => url.split("/").pop() ?? url;

// One client, wired with every optional capability so this harness tests them all.
const wc = new WithingsClient({
  clientId: process.env.WITHINGS_CLIENT_ID ?? "",
  clientSecret: process.env.WITHINGS_CLIENT_SECRET ?? "",
  callbackURL: process.env.WITHINGS_CALLBACK_URL ?? "",
  tokenStore: fileTokenStore, // injectable persistence
  retry: { retries: 2 }, // resilience
  rateLimit: { requestsPerMinute: 100 }, // opt-in throttle (< Withings' 120/min)
  hooks: {
    onRequest: ({ url }) => console.log("  →", action(url)),
    onResponse: ({ url, httpStatus, durationMs }) =>
      console.log("  ←", httpStatus, action(url), `${durationMs}ms`),
    onRetry: ({ attempt, delayMs }) =>
      console.log("  ↻ retry", attempt, "in", `${delayMs}ms`),
  },
});

const SCOPES = [Scope.Info, Scope.Metrics, Scope.Activity];
const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);

// --- Guarded calls: capture typed errors instead of throwing ---
interface Ok<T> {
  label: string;
  ok: true;
  data: T;
}
interface Fail {
  label: string;
  ok: false;
  error: {
    name: string;
    status?: number;
    httpStatus?: number;
    message: string;
  };
}

async function attempt<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<Ok<T> | Fail> {
  try {
    return { label, ok: true, data: await fn() };
  } catch (e) {
    const w = e instanceof WithingsError ? e : undefined;
    return {
      label,
      ok: false,
      error: {
        name: e instanceof Error ? e.name : "Error",
        status: w?.status,
        httpStatus: w?.httpStatus,
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

// --- HTML helpers ---
const esc = (s: unknown): string =>
  String(s).replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c,
  );
const pre = (o: unknown): string =>
  `<pre>${esc(JSON.stringify(o, null, 2))}</pre>`;
const card = (r: Ok<unknown> | Fail): string =>
  r.ok
    ? `<section><h2>✅ ${esc(r.label)}</h2>${pre(r.data)}</section>`
    : `<section class="err"><h2>⚠️ ${esc(r.label)}</h2>${pre(r.error)}</section>`;

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{font:14px/1.5 system-ui,-apple-system,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#111}
  h1{font-size:1.4rem} h2{font-size:.95rem;margin:0 0 .35rem}
  .bar{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:space-between;align-items:center;background:#f4f4f5;padding:.6rem 1rem;border-radius:10px;margin-bottom:1rem}
  section{border:1px solid #e4e4e7;border-radius:10px;padding:.6rem 1rem;margin:.6rem 0;background:#fafafa}
  section.err{border-color:#fca5a5;background:#fef2f2}
  pre{background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:.6rem;overflow:auto;max-height:320px;font-size:12px;margin:0}
  a{color:#0e7490;text-decoration:none} a:hover{text-decoration:underline}
  .btn{display:inline-block;background:#00a3b4;color:#fff;padding:.7rem 1.1rem;border-radius:10px;font-weight:600}
</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`;
}

const app = express();

// Rate-limit every route — a good habit for anything touching auth, and what
// you'd want in production. (Also satisfies CodeQL's missing-rate-limiting rule.)
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true }));

app.get("/authorize", (_req: Request, res: Response) => {
  res.redirect(wc.oauth.authorizeUrl({ scope: SCOPES, state: randomUUID() }));
});

app.get("/callback", async (req: Request, res: Response) => {
  if (req.query.error) {
    res
      .status(400)
      .send(
        page("Denied", `<p>Withings returned: ${esc(req.query.error)}</p>`),
      );
    return;
  }
  try {
    await wc.oauth.exchangeCode(String(req.query.code)); // persisted via fileTokenStore
    res.redirect("/");
  } catch (e) {
    const r = await attempt("oauth.exchangeCode", () => Promise.reject(e));
    res
      .status(500)
      .send(
        page("Exchange failed", `${card(r)}<a href="/authorize">try again</a>`),
      );
  }
});

app.get("/", async (_req: Request, res: Response) => {
  const tokens = await wc.getTokens();
  if (!tokens) {
    res.send(
      page(
        "Withings live test",
        `<p>Not connected yet.</p><a class="btn" href="/authorize">Connect with Withings</a>`,
      ),
    );
    return;
  }

  // Fetch every resource in parallel; each is individually guarded.
  const [devices, goals, measures, activity, workouts, sleep, heart] =
    await Promise.all([
      attempt("devices.list()", () => wc.devices.list()),
      attempt("goals.get()", () => wc.goals.get()),
      attempt("measures.list({ from: -1y })", () =>
        wc.measures.list({ from: daysAgo(365) }),
      ),
      attempt("activity.daily() — last 30d", () => wc.activity.daily()),
      attempt("workouts.list() — last 30d", () => wc.workouts.list()),
      attempt("sleep.summary() — last 30d", () => wc.sleep.summary()),
      attempt("heart.list({ from: -1y })", () =>
        wc.heart.list({ from: daysAgo(365) }),
      ),
    ]);

  // Pagination: stream every measure group across all pages.
  const pagination = await attempt(
    "measures.paginate() — count all groups across pages",
    async () => {
      let n = 0;
      for await (const _g of wc.measures.paginate({ from: daysAgo(365) })) n++;
      return { totalMeasureGroups: n };
    },
  );

  // Utility helpers.
  const utils = await attempt("utility helpers", () => {
    const grp = measures.ok ? measures.data.measuregrps[0] : undefined;
    return Promise.resolve({
      "realValue({value:70500,unit:-3})": realValue({ value: 70500, unit: -3 }),
      latestWeightKg: grp
        ? (measureValue(grp, MeasureType.Weight) ?? null)
        : null,
      "describeStatus(601)": describeStatus(601),
      parseNotifyEvent: parseNotifyEvent(
        "userid=1&appli=1&startdate=100&enddate=200",
      ),
    });
  });

  const session = {
    userId: tokens.userId,
    scope: tokens.scope,
    expiresAt: tokens.expiresAt
      ? new Date(tokens.expiresAt).toISOString()
      : undefined,
    accessToken: tokens.accessToken.slice(0, 6) + "…",
    refreshToken: tokens.refreshToken.slice(0, 6) + "…",
  };

  res.send(
    page(
      "Withings live test — connected",
      `
    <div class="bar">
      <span>Connected as user <b>${esc(session.userId)}</b> · scopes: ${esc(session.scope ?? "")}</span>
      <span><a href="/refresh">↻ force token refresh</a> &nbsp;·&nbsp; <a href="/">reload</a> &nbsp;·&nbsp; <a href="/disconnect">disconnect</a></span>
    </div>
    ${card({ label: "session — getTokens() (from file store)", ok: true, data: session })}
    ${card(utils)}
    ${card(pagination)}
    ${card(devices)}
    ${card(goals)}
    ${card(measures)}
    ${card(activity)}
    ${card(workouts)}
    ${card(sleep)}
    ${card(heart)}`,
    ),
  );
});

app.get("/refresh", async (_req: Request, res: Response) => {
  const r = await attempt("oauth.refresh() — rotates the refresh token", () =>
    wc.oauth.refresh(),
  );
  res.send(page("Token refresh", `${card(r)}<a href="/">← back</a>`));
});

app.get("/disconnect", async (_req: Request, res: Response) => {
  await wc.clearTokens();
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Withings live test → http://localhost:${PORT}`);
});
