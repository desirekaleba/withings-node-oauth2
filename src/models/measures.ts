import type { Paginated } from "./common.js";

/** A single measurement within a group. */
export interface Measure {
  /** Measured value; the real value is `value * 10^unit`. */
  value: number;
  /** Measure type (see {@link MeasureType}). */
  type: number;
  /** Power of ten multiplier applied to `value`. */
  unit: number;
  algo?: number;
  fm?: number;
  [key: string]: unknown;
}

/** A group of measures captured together (typically one weigh-in). */
export interface MeasureGroup {
  grpid: number;
  attrib: number;
  /** Capture time, epoch seconds. */
  date: number;
  created: number;
  category: number;
  deviceid?: string;
  hash_deviceid?: string;
  measures: Measure[];
  comment?: string | null;
  timezone?: string;
  [key: string]: unknown;
}

/** Body of `measure/getmeas`. */
export interface MeasuresBody extends Paginated {
  updatetime: number;
  timezone: string;
  measuregrps: MeasureGroup[];
  [key: string]: unknown;
}
