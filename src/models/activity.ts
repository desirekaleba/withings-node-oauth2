import type { Paginated } from "./common.js";

/** A single day's activity summary. */
export interface ActivitySummary {
  /** Calendar day, `YYYY-MM-DD`. */
  date: string;
  timezone: string;
  steps?: number;
  distance?: number;
  elevation?: number;
  soft?: number;
  moderate?: number;
  intense?: number;
  active?: number;
  calories?: number;
  totalcalories?: number;
  hr_average?: number;
  hr_min?: number;
  hr_max?: number;
  deviceid?: string;
  [key: string]: unknown;
}

/** Body of `measurev2/getactivity`. */
export interface ActivityBody extends Paginated {
  activities: ActivitySummary[];
  [key: string]: unknown;
}

/** A high-resolution intraday activity data point. */
export interface IntradayActivityEntry {
  calories?: number;
  distance?: number;
  duration?: number;
  elevation?: number;
  steps?: number;
  heart_rate?: number;
  [key: string]: unknown;
}

/** Body of `measurev2/getintradayactivity`. Keys are epoch-second timestamps. */
export interface IntradayActivityBody {
  series: Record<string, IntradayActivityEntry>;
  [key: string]: unknown;
}
