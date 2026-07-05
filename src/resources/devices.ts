import { ENDPOINTS } from "../config/index.js";
import type { RequestOptions } from "../types/index.js";
import type { DeviceList } from "../models/user.js";
import { Resource } from "./base.js";

/** The user's linked Withings devices. */
export class DevicesResource extends Resource {
  /** List the user's linked devices. */
  list(options: RequestOptions = {}): Promise<DeviceList> {
    return this.authed<DeviceList>(
      ENDPOINTS.user,
      { action: "getdevice" },
      options,
    );
  }
}
