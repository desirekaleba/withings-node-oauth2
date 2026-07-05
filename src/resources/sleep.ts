import { ENDPOINTS } from "../config/index.js";
import { toEpochSeconds, toYmd, ymdDaysAgo } from "../util/dates.js";
import { paginate } from "./pagination.js";
import type { DateInput, RequestOptions } from "../types/index.js";
import type {
  SleepBody,
  SleepSummaryBody,
  SleepSummarySeries,
} from "../models/sleep.js";
import { Resource } from "./base.js";

/** Options for {@link SleepResource.summary}. */
export interface SleepSummaryOptions extends RequestOptions {
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

/** Options for {@link SleepResource.get}. */
export interface SleepGetOptions extends RequestOptions {
  /** Range start. */
  from?: DateInput;
  /** Range end. */
  to?: DateInput;
  /** Comma-separated fields to include. */
  dataFields?: string;
}

/** Sleep data: nightly summaries and high-frequency sleep states. */
export class SleepResource extends Resource {
  #summaryParams(options: SleepSummaryOptions): Record<string, unknown> {
    return {
      action: "getsummary",
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

  /** Fetch one page of nightly sleep summaries (default: last 30 days). */
  summary(options: SleepSummaryOptions = {}): Promise<SleepSummaryBody> {
    return this.authed<SleepSummaryBody>(
      ENDPOINTS.sleep,
      this.#summaryParams(options),
      options,
    );
  }

  /** Lazily iterate every nightly sleep summary across all pages. */
  paginate(
    options: SleepSummaryOptions = {},
  ): AsyncGenerator<SleepSummarySeries> {
    return paginate<SleepSummaryBody, SleepSummarySeries>(
      (offset) => this.summary({ ...options, offset }),
      (body) => body.series,
    );
  }

  /** Fetch high-frequency sleep-state data for an epoch range. */
  get(options: SleepGetOptions = {}): Promise<SleepBody> {
    return this.authed<SleepBody>(
      ENDPOINTS.sleep,
      {
        action: "get",
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
