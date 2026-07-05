/** A single Notify (webhook) subscription. */
export interface NotifySubscription {
  appli: number;
  callbackurl: string;
  comment?: string;
  expires?: number;
  [key: string]: unknown;
}

/** Body of `notify/list`. */
export interface NotifyListBody {
  profiles: NotifySubscription[];
  [key: string]: unknown;
}

/**
 * The payload Withings POSTs (as `application/x-www-form-urlencoded`) to a
 * registered callback URL when subscribed data changes.
 */
export interface NotifyEvent {
  userid: string;
  appli: number;
  /** Range start of the changed data, epoch seconds. */
  startdate: number;
  /** Range end of the changed data, epoch seconds. */
  enddate: number;
  [key: string]: unknown;
}
