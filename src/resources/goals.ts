import { ENDPOINTS } from "../config/index.js";
import type { RequestOptions } from "../types/index.js";
import type { GoalsBody } from "../models/user.js";
import { Resource } from "./base.js";

/** The user's configured goals (steps, sleep, weight). */
export class GoalsResource extends Resource {
  /** Get the user's goals. */
  get(options: RequestOptions = {}): Promise<GoalsBody> {
    return this.authed<GoalsBody>(
      ENDPOINTS.user,
      { action: "getgoals" },
      options,
    );
  }
}
