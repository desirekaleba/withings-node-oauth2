import { ENDPOINTS } from "../config/index.js";
import { toEpochSeconds } from "../util/dates.js";
import { paginate } from "./pagination.js";
import type { DateInput, RequestOptions } from "../types/index.js";
import type {
  EcgSignalBody,
  HeartListBody,
  HeartRecord,
} from "../models/heart.js";
import { Resource } from "./base.js";

/** Options for {@link HeartResource.list}. */
export interface HeartListOptions extends RequestOptions {
  /** Range start. */
  from?: DateInput;
  /** Range end. */
  to?: DateInput;
  /** Pagination cursor. */
  offset?: number;
}

/** Options for {@link HeartResource.get}. */
export interface EcgGetOptions extends RequestOptions {
  /** ECG signal id (from a heart record's `ecg.signalid`). */
  signalId: number;
}

/** Heart records: ECG recordings, AFib classification, blood pressure. */
export class HeartResource extends Resource {
  /** Fetch one page of heart records. */
  list(options: HeartListOptions = {}): Promise<HeartListBody> {
    return this.authed<HeartListBody>(
      ENDPOINTS.heart,
      {
        action: "list",
        startdate:
          options.from === undefined ? undefined : toEpochSeconds(options.from),
        enddate:
          options.to === undefined ? undefined : toEpochSeconds(options.to),
        offset: options.offset,
      },
      options,
    );
  }

  /** Lazily iterate every heart record across all pages. */
  paginate(options: HeartListOptions = {}): AsyncGenerator<HeartRecord> {
    return paginate<HeartListBody, HeartRecord>(
      (offset) => this.list({ ...options, offset }),
      (body) => body.series,
    );
  }

  /** Fetch a single high-resolution ECG signal. */
  get(options: EcgGetOptions): Promise<EcgSignalBody> {
    return this.authed<EcgSignalBody>(
      ENDPOINTS.heart,
      { action: "get", signalid: options.signalId },
      options,
    );
  }
}
