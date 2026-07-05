/**
 * Subscribe to Withings Notify events and receive them on a webhook endpoint.
 *
 * Withings POSTs `application/x-www-form-urlencoded` payloads; `parseNotifyEvent`
 * normalizes them into a typed `NotifyEvent`.
 */
import express from "express";
import {
  WithingsClient,
  NotifyAppli,
  parseNotifyEvent,
} from "withings-node-oauth2";

const app = express();
app.use(express.urlencoded({ extended: false }));

const wc = new WithingsClient({
  clientId: process.env.WITHINGS_CLIENT_ID!,
  clientSecret: process.env.WITHINGS_CLIENT_SECRET!,
  callbackURL: process.env.WITHINGS_CALLBACK_URL!,
  tokens: {
    accessToken: process.env.WITHINGS_ACCESS_TOKEN!,
    refreshToken: process.env.WITHINGS_REFRESH_TOKEN!,
  },
});

const CALLBACK_URL = "https://hooks.example.com/withings";

// One-time: register the subscription (callback must be publicly reachable).
async function subscribe() {
  await wc.notify.subscribe({
    callbackUrl: CALLBACK_URL,
    appli: NotifyAppli.Weight,
    comment: "Weigh-ins",
  });
  await wc.notify.subscribe({
    callbackUrl: CALLBACK_URL,
    appli: NotifyAppli.Sleep,
    comment: "Sleep summaries",
  });
  console.log("subscribed:", (await wc.notify.list()).profiles);
}

// Receive events.
app.post("/withings", async (req, res) => {
  const event = parseNotifyEvent(req.body);
  console.log(
    `user ${event.userid}: appli ${event.appli} changed ` +
      `between ${event.startdate} and ${event.enddate}`,
  );
  // Fetch the changed data and update your store, then acknowledge quickly.
  res.sendStatus(200);
});

app.listen(3000, subscribe);
