import { ENDPOINTS } from "../config/index.js";
import type { RequestOptions } from "../types/index.js";
import type { Goals, GoalsBody } from "../models/user.js";
import { Resource } from "./base.js";

/** Shape Withings actually returns: `goals` is an object, or `[]` when empty. */
type RawGoalsBody = Omit<GoalsBody, "goals"> & { goals: Goals | unknown[] };

/** The user's configured goals (steps, sleep, weight). */
export class GoalsResource extends Resource {
  /** Get the user's goals. */
  async get(options: RequestOptions = {}): Promise<GoalsBody> {
    const body = await this.authed<RawGoalsBody>(
      ENDPOINTS.user,
      { action: "getgoals" },
      options,
    );
    // Withings returns `goals: []` for accounts with no goals set. Normalize it
    // to an empty object so `body.goals` is always the documented shape.
    return {
      ...body,
      goals: Array.isArray(body.goals) ? {} : body.goals,
    };
  }
}
