import type { DateInput } from "../types/index.js";

/**
 * Coerce a {@link DateInput} into a `Date`.
 *
 * Numbers are interpreted as **epoch seconds** when they look like a Withings
 * timestamp (10-digit / < 1e12) and as **milliseconds** otherwise, matching how
 * the Withings API reports times.
 */
export function toDate(input: DateInput): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") {
    const ms = input < 1e12 ? input * 1000 : input;
    return new Date(ms);
  }
  return new Date(input);
}

/** Convert a {@link DateInput} to Withings epoch **seconds**. */
export function toEpochSeconds(input: DateInput): number {
  return Math.floor(toDate(input).getTime() / 1000);
}

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Format a {@link DateInput} as a `YYYY-MM-DD` string in UTC.
 *
 * Withings' `*ymd` parameters are plain calendar dates, so UTC is used to keep
 * output deterministic regardless of the host timezone.
 */
export function toYmd(input: DateInput): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  const d = toDate(input);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )}`;
}

/** Number of milliseconds in one day. */
export const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` for `days` days before now (UTC). */
export function ymdDaysAgo(days: number): string {
  return toYmd(Date.now() - days * DAY_MS);
}
