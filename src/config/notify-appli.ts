/**
 * Notify (webhook) `appli` categories.
 *
 * @see https://developer.withings.com/developer-guide/v3/data-api/notifications/notification-content/
 */
export const NotifyAppli = {
  /** Weight / body composition (scale). */
  Weight: 1,
  /** Temperature. */
  Temperature: 2,
  /** Blood pressure (and heart rate). */
  BloodPressure: 4,
  /** Activity (steps, distance, calories, workouts). */
  Activity: 16,
  /** Sleep summary. */
  Sleep: 44,
  /** User profile change (account deleted/unlinked/updated). */
  UserInfo: 46,
  /** Bed in. */
  BedIn: 50,
  /** Bed out. */
  BedOut: 51,
  /** Sleep sensor inflation done. */
  InflateDone: 52,
  /** No account associated (device setup). */
  NoAccount: 53,
  /** ECG measurement. */
  Ecg: 54,
  /** ECG measurement failed. */
  EcgFailed: 55,
  /** Glucose. */
  Glucose: 58,
} as const;

export type NotifyAppli = (typeof NotifyAppli)[keyof typeof NotifyAppli];
