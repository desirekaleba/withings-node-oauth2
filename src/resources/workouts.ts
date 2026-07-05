import { ENDPOINTS } from "../config/index.js";
import { toEpochSeconds, toYmd, ymdDaysAgo } from "../util/dates.js";
import { paginate } from "./pagination.js";
import type { DateInput, RequestOptions } from "../types/index.js";
import type { Workout, WorkoutsBody } from "../models/workouts.js";
import { Resource } from "./base.js";

/** Options for {@link WorkoutsResource.list}. */
export interface WorkoutsListOptions extends RequestOptions {
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

/** Workout sessions. */
export class WorkoutsResource extends Resource {
  #params(options: WorkoutsListOptions): Record<string, unknown> {
    return {
      action: "getworkouts",
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

  /** Fetch one page of workouts (default: last 30 days). */
  list(options: WorkoutsListOptions = {}): Promise<WorkoutsBody> {
    return this.authed<WorkoutsBody>(
      ENDPOINTS.measurev2,
      this.#params(options),
      options,
    );
  }

  /** Lazily iterate every workout across all pages. */
  paginate(options: WorkoutsListOptions = {}): AsyncGenerator<Workout> {
    return paginate<WorkoutsBody, Workout>(
      (offset) => this.list({ ...options, offset }),
      (body) => body.series,
    );
  }
}
