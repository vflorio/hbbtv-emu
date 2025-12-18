import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";

export type Occurrence = Readonly<{
  instanceId: string;
  scheduledAtMs: number;
}>;

/**
 * Compute all occurrences of a periodic event within a time window.
 *
 * @param startMs - Start of the time window (milliseconds)
 * @param endMs - End of the time window (milliseconds)
 * @param baseMs - Base time from which the periodic schedule starts
 * @param periodMs - Period of recurrence (milliseconds)
 * @param offsetMs - Offset from base time (milliseconds)
 * @param instanceIdPrefix - Prefix for generating unique instance IDs
 * @returns Array of occurrences within the time window
 */
export const occurrencesBetween = (
  startMs: number,
  endMs: number,
  baseMs: number,
  periodMs: number,
  offsetMs: number,
  instanceIdPrefix: string,
): ReadonlyArray<Readonly<Occurrence>> =>
  pipe(
    O.Do,
    O.bind("periodMs", () => (periodMs > 0 ? O.some(periodMs) : O.none)),
    O.bind("firstAt", () => O.some(baseMs + offsetMs)),
    O.filter(({ firstAt }) => endMs >= firstAt),
    O.bind("fromK", ({ firstAt, periodMs }) => O.some(Math.max(0, Math.floor((startMs - firstAt) / periodMs)))),
    O.bind("toK", ({ firstAt, periodMs }) => O.some(Math.max(0, Math.floor((endMs - firstAt) / periodMs)))),
    O.bind("count", ({ fromK, toK }) =>
      pipe(
        toK - fromK + 1,
        O.fromPredicate((count) => count > 0),
      ),
    ),
    O.map(({ fromK, count, firstAt, periodMs }) =>
      pipe(
        // Safety cap: tick should normally cover a narrow window.
        RA.makeBy(Math.min(count, 8192), (i) => fromK + i),
        RA.map((k) => ({
          instanceId: `${instanceIdPrefix}::${k}`,
          scheduledAtMs: firstAt + k * periodMs,
        })),
        RA.filter((o) => o.scheduledAtMs >= startMs && o.scheduledAtMs <= endMs),
      ),
    ),
    O.getOrElse((): ReadonlyArray<Occurrence> => RA.empty),
  );

/**
 * Clamp milliseconds to a non-negative integer.
 */
export const clampMs = (ms: number): number => Math.max(0, Math.floor(ms));

/**
 * Convert seconds to milliseconds with fallback.
 *
 * @param seconds - Value in seconds (or undefined)
 * @param fallback - Fallback value if seconds is undefined
 * @returns Milliseconds (clamped to non-negative integer)
 */
export const msFromSeconds = (seconds: number | undefined, fallback: number): number =>
  clampMs(((typeof seconds === "number" ? seconds : fallback) ?? fallback) * 1000);

/**
 * Calculate the cycle duration for one-time events (timestamps/delay modes).
 * Ensures the event fires once per cycle with a minimum cycle of 1 second.
 *
 * @param atMs - The time at which the event should fire (milliseconds)
 * @returns Cycle duration (milliseconds)
 */
export const cycleDurationMsFor = (atMs: number): number => Math.max(1000, atMs + 1000);
