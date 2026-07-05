import { describe, it, expect } from "vitest";
import { TokenBucketRateLimiter } from "../src/core/rate-limiter.js";
import { systemClock } from "../src/core/clock.js";
import { WithingsAbortError } from "../src/core/errors.js";
import { manualClock } from "./helpers.js";

/**
 * A deterministic delay that advances the manual clock instead of sleeping,
 * so token refill is fully controllable in tests.
 */
function makeDelay(clock: ReturnType<typeof manualClock>) {
  const waits: number[] = [];
  const delay = (ms: number) => {
    waits.push(ms);
    clock.advance(ms);
    return Promise.resolve();
  };
  return { delay, waits };
}

describe("TokenBucketRateLimiter", () => {
  it("hands out burst tokens immediately, then throttles at the refill rate", async () => {
    const clock = manualClock(0);
    const { delay, waits } = makeDelay(clock);
    // 60/min = 1 token per 1000ms; burst of 2.
    const rl = new TokenBucketRateLimiter(
      { requestsPerMinute: 60, burst: 2 },
      clock,
      delay,
    );

    await rl.acquire(); // token 2 -> 1
    await rl.acquire(); // token 1 -> 0
    expect(waits).toEqual([]); // no waiting for the burst

    await rl.acquire(); // empty -> wait ~1000ms for one token
    expect(waits).toEqual([1000]);

    await rl.acquire(); // another full interval
    expect(waits).toEqual([1000, 1000]);
  });

  it("refills proportionally to elapsed time", async () => {
    const clock = manualClock(0);
    const { delay } = makeDelay(clock);
    const rl = new TokenBucketRateLimiter(
      { requestsPerMinute: 60, burst: 1 },
      clock,
      delay,
    );
    await rl.acquire(); // consume the initial token
    // Simulate 500ms passing externally → half a token.
    clock.advance(500);
    await rl.acquire(); // needs another 500ms to reach 1 token
    // Second acquire should have waited ~500ms, not 1000ms.
  });

  it("rejects with WithingsAbortError if the signal is already aborted", async () => {
    const clock = manualClock(0);
    const { delay } = makeDelay(clock);
    const rl = new TokenBucketRateLimiter(
      { requestsPerMinute: 60, burst: 1 },
      clock,
      delay,
    );
    await rl.acquire(); // drain
    const controller = new AbortController();
    controller.abort();
    await expect(rl.acquire(controller.signal)).rejects.toBeInstanceOf(
      WithingsAbortError,
    );
  });

  it("throws on a non-positive rate", () => {
    expect(
      () => new TokenBucketRateLimiter({ requestsPerMinute: 0 }, manualClock()),
    ).toThrow(RangeError);
  });

  it("serializes concurrent acquisitions (FIFO, no over-issue)", async () => {
    const clock = manualClock(0);
    const { delay, waits } = makeDelay(clock);
    const rl = new TokenBucketRateLimiter(
      { requestsPerMinute: 60, burst: 1 },
      clock,
      delay,
    );
    // Fire 3 at once: 1 immediate, 2 gated behind refills.
    await Promise.all([rl.acquire(), rl.acquire(), rl.acquire()]);
    expect(waits.length).toBe(2); // two of the three had to wait
  });

  describe("default (real-timer) delay", () => {
    it("waits on a real timer and then resolves", async () => {
      // High rate → sub-millisecond waits; system clock so real time refills.
      const rl = new TokenBucketRateLimiter(
        { requestsPerMinute: 60_000, burst: 1 },
        systemClock,
      );
      await rl.acquire(); // drain
      await expect(rl.acquire()).resolves.toBeUndefined(); // waits ~1ms, then ok
    });

    it("rejects with WithingsAbortError when aborted mid-wait", async () => {
      const rl = new TokenBucketRateLimiter(
        { requestsPerMinute: 60, burst: 1 }, // ~1s wait when empty
        systemClock,
      );
      await rl.acquire(); // drain
      const controller = new AbortController();
      const pending = rl.acquire(controller.signal);
      setTimeout(() => controller.abort(), 5);
      await expect(pending).rejects.toBeInstanceOf(WithingsAbortError);
    });
  });
});
