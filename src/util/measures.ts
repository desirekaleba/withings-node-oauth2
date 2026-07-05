import type { MeasureType } from "../config/measure-types.js";
import type { Measure, MeasureGroup } from "../models/measures.js";

/**
 * Convert a raw Withings {@link Measure} to its real numeric value.
 *
 * Withings encodes values as `value * 10^unit` to avoid floats — e.g. a weight
 * of `70.5 kg` is reported as `{ value: 70500, unit: -3 }`.
 *
 * @example
 * ```ts
 * realValue({ value: 70500, unit: -3, type: 1 }); // 70.5
 * ```
 */
export function realValue(measure: Pick<Measure, "value" | "unit">): number {
  return measure.value * 10 ** measure.unit;
}

/** Find the first measure of a given type within a group. */
export function findMeasure(
  group: MeasureGroup,
  type: MeasureType | number,
): Measure | undefined {
  return group.measures.find((m) => m.type === type);
}

/**
 * Return the real value of the first measure of `type` in a group, or
 * `undefined` if the group has no such measure.
 */
export function measureValue(
  group: MeasureGroup,
  type: MeasureType | number,
): number | undefined {
  const measure = findMeasure(group, type);
  return measure ? realValue(measure) : undefined;
}
