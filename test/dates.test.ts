import { describe, it, expect } from "vitest";
import {
  toDate,
  toEpochSeconds,
  toYmd,
  ymdDaysAgo,
  DAY_MS,
} from "../src/util/dates.js";

describe("toDate", () => {
  it("returns a Date unchanged", () => {
    const d = new Date("2024-01-02T03:04:05Z");
    expect(toDate(d)).toBe(d);
  });

  it("treats small numbers as epoch seconds", () => {
    expect(toDate(1_700_000_000).getTime()).toBe(1_700_000_000 * 1000);
  });

  it("treats large numbers as epoch milliseconds", () => {
    const ms = 1_700_000_000_000;
    expect(toDate(ms).getTime()).toBe(ms);
  });

  it("parses ISO strings", () => {
    expect(toDate("2024-01-02T00:00:00Z").getUTCFullYear()).toBe(2024);
  });
});

describe("toEpochSeconds", () => {
  it("converts a Date to whole seconds", () => {
    expect(toEpochSeconds(new Date("2024-01-01T00:00:00Z"))).toBe(1704067200);
  });
});

describe("toYmd", () => {
  it("formats a Date as UTC YYYY-MM-DD with zero padding", () => {
    expect(toYmd(new Date("2024-03-05T23:00:00Z"))).toBe("2024-03-05");
  });

  it("passes through an already-formatted YMD string", () => {
    expect(toYmd("2022-12-31")).toBe("2022-12-31");
  });

  it("formats epoch seconds", () => {
    expect(toYmd(1704067200)).toBe("2024-01-01");
  });
});

describe("ymdDaysAgo", () => {
  it("returns a valid YMD string in the past", () => {
    const result = ymdDaysAgo(30);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const then = new Date(`${result}T00:00:00Z`).getTime();
    expect(Date.now() - then).toBeGreaterThanOrEqual(29 * DAY_MS);
  });
});
