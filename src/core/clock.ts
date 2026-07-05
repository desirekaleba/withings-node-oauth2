/**
 * An injectable source of the current time. Swapping this out makes signing and
 * token-expiry logic deterministic in tests.
 */
export interface Clock {
  /** Current time in milliseconds since the Unix epoch. */
  now(): number;
}

/** The default {@link Clock}, backed by `Date.now()`. */
export const systemClock: Clock = {
  now: () => Date.now(),
};
