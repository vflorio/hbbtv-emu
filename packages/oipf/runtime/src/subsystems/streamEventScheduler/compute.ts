import { cycleDurationMsFor, msFromSeconds, occurrencesBetween } from "@hbb-emu/core";
import type { StreamEventConfig, StreamEventScheduleMode } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as N from "fp-ts/number";
import * as Ord from "fp-ts/Ord";
import * as RA from "fp-ts/ReadonlyArray";
import * as Str from "fp-ts/string";
import { match } from "ts-pattern";

export type FiredAtByInstanceId = ReadonlyMap<string, number>;

export type DueOccurrence = Readonly<{
  instanceId: string;
  scheduledAtMs: number;
  event: StreamEventConfig;
}>;

const compactFiredMemory = (params: {
  nowMs: number;
  memoryRetentionMs: number;
  maxMemoryEntries: number;
  fired: FiredAtByInstanceId;
}): FiredAtByInstanceId => {
  const threshold = params.nowMs - Math.max(0, params.memoryRetentionMs);
  const retained: Array<readonly [string, number]> = Array.from(params.fired.entries()).filter(
    ([, firedAt]) => firedAt >= threshold,
  );

  const byFiredAtAsc: Ord.Ord<readonly [number, string]> = Ord.tuple(N.Ord, Str.Ord);

  const sorted = retained.sort((a: readonly [string, number], b: readonly [string, number]) =>
    byFiredAtAsc.compare([a[1], a[0]], [b[1], b[0]]),
  );
  const trimmed =
    params.maxMemoryEntries > 0 && sorted.length > params.maxMemoryEntries
      ? sorted.slice(sorted.length - params.maxMemoryEntries)
      : sorted;

  return new Map(trimmed);
};

export const computeDueStreamEvents = (params: {
  nowMs: number;
  windowStartMs: number;
  baseTimeMs: number;
  tickIntervalMs: number;
  events: ReadonlyArray<StreamEventConfig>;
  fired: FiredAtByInstanceId;
  memoryRetentionMs: number;
  maxMemoryEntries: number;
}): Readonly<{ due: ReadonlyArray<DueOccurrence>; nextFired: FiredAtByInstanceId }> => {
  const startMs = Math.min(params.windowStartMs, params.nowMs);
  const endMs = params.nowMs;

  const enabled = pipe(
    params.events,
    RA.filter((e) => e.enabled),
  );

  const scheduled: ReadonlyArray<DueOccurrence> = pipe(
    enabled,
    RA.flatMap((event) =>
      match(resolveScheduleMode(event))
        .with("interval", () => {
          const intervalMs = Math.max(1000, msFromSeconds(event.intervalSeconds, 10));
          const offsetMs = msFromSeconds(event.offsetSeconds, 0);
          return pipe(
            occurrencesBetween(startMs, endMs, params.baseTimeMs, intervalMs, offsetMs, `${event.id}::interval`),
            RA.map((o) => ({ ...o, event })),
          );
        })
        .with("timestamps", () => {
          const atMs = msFromSeconds(event.atSeconds, 0);
          const cycleMs = cycleDurationMsFor(atMs);
          return pipe(
            occurrencesBetween(startMs, endMs, params.baseTimeMs, cycleMs, atMs, `${event.id}::timestamps`),
            RA.map((o) => ({ ...o, event })),
          );
        })
        .with("delay", () => {
          const delayMs = msFromSeconds(event.delaySeconds, 0);
          const cycleMs = cycleDurationMsFor(delayMs);
          return pipe(
            occurrencesBetween(startMs, endMs, params.baseTimeMs, cycleMs, delayMs, `${event.id}::delay`),
            RA.map((o) => ({ ...o, event })),
          );
        })
        .exhaustive(),
    ),
  );

  // Deduplicate via persistent fired instance IDs.
  const { due, nextFired } = scheduled.reduce<{
    due: DueOccurrence[];
    nextFired: Map<string, number>;
  }>(
    (acc, occurrence) => {
      if (acc.nextFired.has(occurrence.instanceId)) return acc;
      acc.nextFired.set(occurrence.instanceId, occurrence.scheduledAtMs);
      acc.due.push(occurrence);
      return acc;
    },
    { due: [], nextFired: new Map(params.fired) },
  );

  const compacted = compactFiredMemory({
    nowMs: params.nowMs,
    memoryRetentionMs: params.memoryRetentionMs,
    maxMemoryEntries: params.maxMemoryEntries,
    fired: nextFired,
  });

  return {
    due: due.sort((a, b) => a.scheduledAtMs - b.scheduledAtMs),
    nextFired: compacted,
  };
};

const resolveScheduleMode = (event: StreamEventConfig): StreamEventScheduleMode =>
  (event.scheduleMode as StreamEventScheduleMode | undefined) ?? "delay";
