/**
 * Poll and page through historical data with the async-iterator API, and
 * observe requests via lifecycle hooks.
 */
import "dotenv/config";
import { WithingsClient, MeasureType } from "withings-node-oauth2";

const wc = new WithingsClient({
  clientId: process.env.WITHINGS_CLIENT_ID!,
  clientSecret: process.env.WITHINGS_CLIENT_SECRET!,
  callbackURL: process.env.WITHINGS_CALLBACK_URL!,
  tokens: {
    accessToken: process.env.WITHINGS_ACCESS_TOKEN!,
    refreshToken: process.env.WITHINGS_REFRESH_TOKEN!,
    expiresAt: Number(process.env.WITHINGS_EXPIRES_AT) || undefined,
  },
  hooks: {
    onResponse: ({ url, httpStatus, durationMs }) =>
      console.debug(`${httpStatus} ${url} (${durationMs}ms)`),
    onRetry: ({ url, attempt, delayMs }) =>
      console.warn(`retry #${attempt} of ${url} in ${delayMs}ms`),
  },
});

// Stream every weight measurement across all pages — no offset bookkeeping.
async function main() {
  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // last year
  let count = 0;
  for await (const group of wc.measures.paginate({
    types: [MeasureType.Weight],
    from,
  })) {
    count += group.measures.length;
  }
  console.log(`streamed ${count} weight measures`);

  // Iterate nightly sleep summaries the same way.
  for await (const night of wc.sleep.paginate()) {
    console.log(night.date, "score:", night.data.sleep_score);
  }
}

main().catch((err) => {
  console.error(err.name, err.status, err.message);
  process.exitCode = 1;
});
