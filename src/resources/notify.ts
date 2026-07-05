import { ENDPOINTS } from "../config/index.js";
import type { AppliInput, RequestOptions } from "../types/index.js";
import type { NotifyListBody, NotifySubscription } from "../models/notify.js";
import { Resource } from "./base.js";

/** Options for {@link NotifyResource.subscribe}. */
export interface NotifySubscribeOptions extends RequestOptions {
  /** Public HTTPS URL Withings will POST events to. */
  callbackUrl: string;
  /** Category of data to subscribe to. */
  appli: AppliInput;
  /** Optional human-readable comment shown in the dashboard. */
  comment?: string;
}

/** Options for {@link NotifyResource.get}. */
export interface NotifyGetOptions extends RequestOptions {
  callbackUrl: string;
  appli: AppliInput;
}

/** Options for {@link NotifyResource.list}. */
export interface NotifyListOptions extends RequestOptions {
  appli?: AppliInput;
}

/** Options for {@link NotifyResource.update}. */
export interface NotifyUpdateOptions extends RequestOptions {
  callbackUrl: string;
  appli: AppliInput;
  newCallbackUrl?: string;
  newAppli?: AppliInput;
  comment?: string;
}

/** Options for {@link NotifyResource.revoke}. */
export interface NotifyRevokeOptions extends RequestOptions {
  callbackUrl: string;
  appli?: AppliInput;
}

/**
 * The Notify (webhook) resource. `subscribe` carries the required nonce +
 * signature automatically; the callback URL must be publicly reachable and
 * registered in your app dashboard.
 */
export class NotifyResource extends Resource {
  /** Subscribe a callback URL to a notification category. */
  async subscribe(options: NotifySubscribeOptions): Promise<void> {
    await this.signedAuthed(
      ENDPOINTS.notify,
      "subscribe",
      {
        callbackurl: options.callbackUrl,
        appli: options.appli,
        comment: options.comment,
      },
      options,
    );
  }

  /** Get the details of a single subscription. */
  get(options: NotifyGetOptions): Promise<NotifySubscription> {
    return this.authed<NotifySubscription>(
      ENDPOINTS.notify,
      { action: "get", callbackurl: options.callbackUrl, appli: options.appli },
      options,
    );
  }

  /** List the user's subscriptions, optionally filtered by `appli`. */
  list(options: NotifyListOptions = {}): Promise<NotifyListBody> {
    return this.authed<NotifyListBody>(
      ENDPOINTS.notify,
      { action: "list", appli: options.appli },
      options,
    );
  }

  /** Update an existing subscription. */
  async update(options: NotifyUpdateOptions): Promise<void> {
    await this.authed(
      ENDPOINTS.notify,
      {
        action: "update",
        callbackurl: options.callbackUrl,
        appli: options.appli,
        new_callbackurl: options.newCallbackUrl,
        new_appli: options.newAppli,
        comment: options.comment,
      },
      options,
    );
  }

  /** Revoke (delete) a subscription. */
  async revoke(options: NotifyRevokeOptions): Promise<void> {
    await this.authed(
      ENDPOINTS.notify,
      {
        action: "revoke",
        callbackurl: options.callbackUrl,
        appli: options.appli,
      },
      options,
    );
  }
}
