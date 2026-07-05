import type { Paginated } from "./common.js";

/** Per-workout aggregated metrics (fields depend on the requested `data_fields`). */
export interface WorkoutData {
  calories?: number;
  distance?: number;
  steps?: number;
  elevation?: number;
  hr_average?: number;
  hr_min?: number;
  hr_max?: number;
  [key: string]: unknown;
}

/** A single workout session. */
export interface Workout {
  /** Workout category id. */
  category: number;
  timezone: string;
  model?: number;
  attrib?: number;
  /** Start time, epoch seconds. */
  startdate: number;
  /** End time, epoch seconds. */
  enddate: number;
  date?: string;
  deviceid?: string;
  data?: WorkoutData;
  [key: string]: unknown;
}

/** Body of `measurev2/getworkouts`. */
export interface WorkoutsBody extends Paginated {
  series: Workout[];
  [key: string]: unknown;
}
