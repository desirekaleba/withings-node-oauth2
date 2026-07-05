import type { NotifyEvent } from "../models/notify.js";

/**
 * Input accepted by {@link parseNotifyEvent}: the raw form-encoded string
 * Withings POSTs, an already-parsed body object, or `URLSearchParams`.
 */
export type NotifyEventInput =
  string | URLSearchParams | Record<string, unknown>;

/**
 * Parse an incoming Withings Notify (webhook) callback into a typed
 * {@link NotifyEvent}.
 *
 * Withings delivers events as `application/x-www-form-urlencoded` POSTs with
 * `userid`, `appli`, `startdate`, and `enddate`. This normalizes the payload
 * regardless of how your framework exposes the body and coerces the numeric
 * fields.
 *
 * @throws {TypeError} If required fields (`userid`, `appli`) are missing.
 *
 * @example
 * ```ts
 * app.post("/withings/webhook", (req, res) => {
 *   const event = parseNotifyEvent(req.body); // express.urlencoded()
 *   enqueueSync(event.userid, event.appli, event.startdate, event.enddate);
 *   res.sendStatus(200);
 * });
 * ```
 */
export function parseNotifyEvent(input: NotifyEventInput): NotifyEvent {
  const get = toGetter(input);

  const userid = get("userid");
  const appliRaw = get("appli");
  if (userid === undefined || appliRaw === undefined) {
    throw new TypeError(
      "Invalid Withings Notify payload: missing `userid` or `appli`.",
    );
  }

  const event: NotifyEvent = {
    userid: String(userid),
    appli: Number(appliRaw),
    startdate: toNumber(get("startdate")),
    enddate: toNumber(get("enddate")),
  };

  // Preserve any extra fields Withings may include.
  if (input instanceof URLSearchParams) {
    for (const [key, value] of input) {
      if (!(key in event)) event[key] = value;
    }
  } else if (typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      if (!(key in event)) event[key] = value;
    }
  }

  return event;
}

function toGetter(input: NotifyEventInput): (key: string) => unknown {
  const params =
    typeof input === "string"
      ? new URLSearchParams(input)
      : input instanceof URLSearchParams
        ? input
        : undefined;
  if (params) return (key) => params.get(key) ?? undefined;
  const obj = input as Record<string, unknown>;
  return (key) => obj[key];
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
