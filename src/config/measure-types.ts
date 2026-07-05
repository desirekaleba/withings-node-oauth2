/**
 * Common `meastype` values for `measures.list`.
 *
 * @see https://developer.withings.com/api-reference/#tag/measure
 */
export const MeasureType = {
  Weight: 1,
  Height: 4,
  FatFreeMass: 5,
  FatRatio: 6,
  FatMassWeight: 8,
  DiastolicBloodPressure: 9,
  SystolicBloodPressure: 10,
  HeartPulse: 11,
  Temperature: 12,
  Spo2: 54,
  BodyTemperature: 71,
  SkinTemperature: 73,
  MuscleMass: 76,
  Hydration: 77,
  BoneMass: 88,
  PulseWaveVelocity: 91,
  Vo2Max: 123,
} as const;

export type MeasureType = (typeof MeasureType)[keyof typeof MeasureType];
