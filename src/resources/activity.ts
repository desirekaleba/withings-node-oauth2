import { ENDPOINTS } from "../config/index.js";
import { toEpochSeconds, toYmd, ymdDaysAgo } from "../util/dates.js";
import { paginate } from "./pagination.js";
import type { DateInput, RequestOptions } from "../types/index.js";
import type {
  ActivityBody,
  ActivitySummary,
  IntradayActivityBody,
} from "../models/activity.js";
import { Resource } from "./base.js";

/** Options for {@link ActivityResource.daily}. */
export interface ActivityDailyOptions extends RequestOptions {
  /** Range start (defaults to 30 days ago). */
  from?: DateInput;
  /** Range end (defaults to today). */
  to?: DateInput;
  /** Only return rows updated after this time. */
  lastUpdate?: DateInput;
  /** Comma-separated fields to include. */
  dataFields?: string;
  /** Pagination cursor. */
  offset?: number;
}

/** Options for {@link ActivityResource.intraday}. */
export interface IntradayActivityOptions extends RequestOptions {
  /** Range start. */
  from?: DateInput;
  /** Range end. */
  to?: DateInput;
  /** Comma-separated fields to include. */
  dataFields?: string;
}

/** Physical activity: daily summaries and high-resolution intraday data. */
export class ActivityResource extends Resource {
  #dailyParams(options: ActivityDailyOptions): Record<string, unknown> {
    return {
      action: "getactivity",
      startdateymd:
        options.from === undefined ? ymdDaysAgo(30) : toYmd(options.from),
      enddateymd:
        options.to === undefined ? toYmd(Date.now()) : toYmd(options.to),
      lastupdate:
        options.lastUpdate === undefined
          ? undefined
          : toEpochSeconds(options.lastUpdate),
      data_fields: options.dataFields,
      offset: options.offset,
    };
  }

  /** Fetch one page of daily activity summaries (default: last 30 days). */
  daily(options: ActivityDailyOptions = {}): Promise<ActivityBody> {
    return this.authed<ActivityBody>(
      ENDPOINTS.measurev2,
      this.#dailyParams(options),
      options,
    );
  }

  /** Lazily iterate every daily activity summary across all pages. */
  paginate(
    options: ActivityDailyOptions = {},
  ): AsyncGenerator<ActivitySummary> {
    return paginate<ActivityBody, ActivitySummary>(
      (offset) => this.daily({ ...options, offset }),
      (body) => body.activities,
    );
  }

  /** Fetch high-resolution intraday activity for an epoch range. */
  intraday(
    options: IntradayActivityOptions = {},
  ): Promise<IntradayActivityBody> {
    return this.authed<IntradayActivityBody>(
      ENDPOINTS.measurev2,
      {
        action: "getintradayactivity",
        startdate:
          options.from === undefined ? undefined : toEpochSeconds(options.from),
        enddate:
          options.to === undefined ? undefined : toEpochSeconds(options.to),
        data_fields: options.dataFields,
      },
      options,
    );
  }
}
