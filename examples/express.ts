/**
 * Full OAuth2 flow + data fetch with Express.
 *
 * Run: set WITHINGS_CLIENT_ID / WITHINGS_CLIENT_SECRET / WITHINGS_CALLBACK_URL,
 * then `tsx examples/express.ts` and open http://localhost:3000/authorize.
 */
import { randomUUID } from "node:crypto";
import express from "express";
import {
  WithingsClient,
  Scope,
  MeasureType,
  measureValue,
} from "withings-node-oauth2";

const app = express();

const wc = new WithingsClient({
  clientId: process.env.WITHINGS_CLIENT_ID!,
  clientSecret: process.env.WITHINGS_CLIENT_SECRET!,
  callbackURL: process.env.WITHINGS_CALLBACK_URL!,
  // Persist rotated tokens somewhere durable in a real app:
  onTokenRefresh: (tokens) =>
    console.log("tokens refreshed for", tokens.userId),
});

app.get("/authorize", (_req, res) => {
  const url = wc.oauth.authorizeUrl({
    scope: [Scope.Info, Scope.Metrics, Scope.Activity],
    state: randomUUID(),
  });
  res.redirect(url);
});

app.get("/callback", async (req, res, next) => {
  try {
    const tokens = await wc.oauth.exchangeCode(String(req.query.code));
    res.json({ userId: tokens.userId, scope: tokens.scope });
  } catch (err) {
    next(err);
  }
});

app.get("/latest-weight", async (_req, res, next) => {
  try {
    const { measuregrps } = await wc.measures.list({
      types: [MeasureType.Weight],
    });
    const kg =
      measuregrps[0] && measureValue(measuregrps[0], MeasureType.Weight);
    res.json({ weightKg: kg ?? null });
  } catch (err) {
    next(err);
  }
});

app.listen(3000, () => console.log("http://localhost:3000/authorize"));
