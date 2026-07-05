/**
 * OAuth2 scopes accepted by Withings.
 *
 * @see https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/oauth-authorization-url/
 */
export const Scope = {
  /** Account info, linked devices and goals. */
  Info: "user.info",
  /** Health measurements (weight, blood pressure, ECG, glucose…). */
  Metrics: "user.metrics",
  /** Physical activity, sleep and workouts. */
  Activity: "user.activity",
  /** Real-time sleep-event notifications (bed in/out). */
  SleepEvents: "user.sleepevents",
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];
