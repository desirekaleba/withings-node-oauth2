/** A device linked to the user's Withings account. */
export interface Device {
  type: string;
  model: string;
  model_id: number;
  battery: string;
  deviceid: string;
  hash_deviceid: string;
  timezone: string;
  last_session_date: number;
  [key: string]: unknown;
}

/** Body of `user/getdevice`. */
export interface DeviceList {
  devices: Device[];
  [key: string]: unknown;
}

/** A weight goal with its unit exponent. */
export interface WeightGoal {
  value: number;
  unit: number;
}

/** The user's configured goals. */
export interface Goals {
  steps?: number;
  sleep?: number;
  weight?: WeightGoal;
  [key: string]: unknown;
}

/** Body of `user/getgoals`. */
export interface GoalsBody {
  goals: Goals;
  [key: string]: unknown;
}
