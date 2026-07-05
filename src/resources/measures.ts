import { ENDPOINTS, type MeasureType } from "../config/index.js";
import { toEpochSeconds } from "../util/dates.js";
import { paginate } from "./pagination.js";
import type { DateInput, RequestOptions } from "../types/index.js";
import type { MeasureGroup, MeasuresBody } from "../models/measures.js";
import { Resource } from "./base.js";

/** Options for {@link MeasuresResource.list}. */
export interface MeasuresListOptions extends RequestOptions {
  /** Measure types to return. Omit for all types. */
  types?: Array<MeasureType | number>;
  /** A single measure type (alternative to `types`). */
  type?: MeasureType | number;
  /** `1` = real measures (default on Withings), `2` = user objectives. */
  category?: number;
  /** Range start. */
  from?: DateInput;
  /** Range end. */
  to?: DateInput;
  /** Only return rows updated after this time. */
  lastUpdate?: DateInput;
  /** Pagination cursor. */
  offset?: number;
}

/** Body measurements: weight, height, blood pressure, temperature, SpO₂, … */
export class MeasuresResource extends Resource {
  #params(options: MeasuresListOptions): Record<string, unknown> {
    return {
      action: "getmeas",
      meastypes: options.types?.join(","),
      meastype: options.type,
      category: options.category,
      startdate:
        options.from === undefined ? undefined : toEpochSeconds(options.from),
      enddate:
        options.to === undefined ? undefined : toEpochSeconds(options.to),
      lastupdate:
        options.lastUpdate === undefined
          ? undefined
          : toEpochSeconds(options.lastUpdate),
      offset: options.offset,
    };
  }

  /** Fetch one page of measurement groups. */
  list(options: MeasuresListOptions = {}): Promise<MeasuresBody> {
    return this.authed<MeasuresBody>(
      ENDPOINTS.measure,
      this.#params(options),
      options,
    );
  }

  /** Lazily iterate every measurement group across all pages. */
  paginate(options: MeasuresListOptions = {}): AsyncGenerator<MeasureGroup> {
    return paginate<MeasuresBody, MeasureGroup>(
      (offset) => this.list({ ...options, offset }),
      (body) => body.measuregrps,
    );
  }
}
