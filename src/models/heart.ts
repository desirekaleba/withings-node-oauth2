import type { Paginated } from "./common.js";

/** ECG recording metadata attached to a heart record. */
export interface EcgRecord {
  signalid: number;
  afib?: number;
  [key: string]: unknown;
}

/** A blood-pressure reading attached to a heart record. */
export interface BloodPressure {
  diastole: number;
  systole: number;
  [key: string]: unknown;
}

/** A single heart record (an ECG and/or blood-pressure measurement). */
export interface HeartRecord {
  deviceid?: string;
  model: number;
  ecg?: EcgRecord;
  bloodpressure?: BloodPressure;
  heart_rate?: number;
  /** Measurement time, epoch seconds. */
  timestamp: number;
  [key: string]: unknown;
}

/** Body of `heart/list`. */
export interface HeartListBody extends Paginated {
  series: HeartRecord[];
  [key: string]: unknown;
}

/** Body of `heart/get` — a raw ECG signal. */
export interface EcgSignalBody {
  signal: number[];
  sampling_frequency: number;
  wearposition?: number;
  [key: string]: unknown;
}
