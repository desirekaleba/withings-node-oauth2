import { describe, it, expect } from "vitest";
import { realValue, findMeasure, measureValue } from "../src/util/measures.js";
import { parseNotifyEvent } from "../src/util/webhook.js";
import { describeStatus } from "../src/config/status-codes.js";
import { MeasureType } from "../src/config/measure-types.js";
import type { MeasureGroup } from "../src/models/measures.js";

const group: MeasureGroup = {
  grpid: 1,
  attrib: 0,
  date: 1704067200,
  created: 1704067200,
  category: 1,
  measures: [
    { value: 70500, type: MeasureType.Weight, unit: -3 },
    { value: 185, type: MeasureType.Height, unit: -2 },
  ],
};

describe("measure helpers", () => {
  it("realValue applies the unit exponent", () => {
    expect(realValue({ value: 70500, unit: -3 })).toBeCloseTo(70.5);
    expect(realValue({ value: 185, unit: -2 })).toBeCloseTo(1.85);
    expect(realValue({ value: 5, unit: 0 })).toBe(5);
  });

  it("findMeasure returns the matching measure or undefined", () => {
    expect(findMeasure(group, MeasureType.Weight)?.value).toBe(70500);
    expect(findMeasure(group, MeasureType.HeartPulse)).toBeUndefined();
  });

  it("measureValue returns the real value or undefined", () => {
    expect(measureValue(group, MeasureType.Weight)).toBeCloseTo(70.5);
    expect(measureValue(group, MeasureType.HeartPulse)).toBeUndefined();
  });
});

describe("parseNotifyEvent", () => {
  it("parses a form-encoded string and coerces numbers", () => {
    const e = parseNotifyEvent(
      "userid=123&appli=1&startdate=1704067200&enddate=1704153600",
    );
    expect(e).toMatchObject({
      userid: "123",
      appli: 1,
      startdate: 1704067200,
      enddate: 1704153600,
    });
  });

  it("parses a parsed object body and preserves extra fields", () => {
    const e = parseNotifyEvent({ userid: 7, appli: "44", extra: "x" });
    expect(e.userid).toBe("7");
    expect(e.appli).toBe(44);
    expect(e.extra).toBe("x");
  });

  it("parses URLSearchParams", () => {
    const e = parseNotifyEvent(
      new URLSearchParams({ userid: "9", appli: "4" }),
    );
    expect(e.userid).toBe("9");
    expect(e.appli).toBe(4);
    expect(e.startdate).toBe(0); // missing → 0
  });

  it("throws on a payload missing required fields", () => {
    expect(() => parseNotifyEvent("appli=1")).toThrow(TypeError);
    expect(() => parseNotifyEvent({ userid: "1" })).toThrow(/appli/);
  });
});

describe("describeStatus", () => {
  it("describes known codes and returns undefined for unknown", () => {
    expect(describeStatus(0)).toMatch(/successful/i);
    expect(describeStatus(601)).toMatch(/rate limit/i);
    expect(describeStatus(342)).toMatch(/signature|nonce/i);
    expect(describeStatus(999999)).toBeUndefined();
  });
});
