import type { Paginated } from "./common.js";

/** Aggregated metrics for one night (fields depend on `data_fields`). */
export interface SleepSummaryData {
  wakeupduration?: number;
  lightsleepduration?: number;
  deepsleepduration?: number;
  remsleepduration?: number;
  durationtosleep?: number;
  durationtowakeup?: number;
  wakeupcount?: number;
  hr_average?: number;
  hr_min?: number;
  hr_max?: number;
  rr_average?: number;
  snoring?: number;
  sleep_score?: number;
  apnea_hypopnea_index?: number;
  [key: string]: unknown;
}

/** A single night's sleep summary. */
export interface SleepSummarySeries {
  id?: number;
  timezone: string;
  model: number;
  /** Night start, epoch seconds. */
  startdate: number;
  /** Night end, epoch seconds. */
  enddate: number;
  date?: string;
  data: SleepSummaryData;
  [key: string]: unknown;
}

/** Body of `sleepv2/getsummary`. */
export interface SleepSummaryBody extends Paginated {
  series: SleepSummarySeries[];
  [key: string]: unknown;
}

/** A high-frequency sleep-state interval. */
export interface SleepSeries {
  /** Interval start, epoch seconds. */
  startdate: number;
  /** Interval end, epoch seconds. */
  enddate: number;
  /** Sleep state: 0 awake, 1 light, 2 deep, 3 REM. */
  state: number;
  [key: string]: unknown;
}

/** Body of `sleep/get`. */
export interface SleepBody {
  series: SleepSeries[];
  model?: number;
  [key: string]: unknown;
}
