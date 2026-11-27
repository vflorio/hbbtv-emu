import type { ChannelConfig, StreamEventConfig } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf-api";
import { describe, expect, it } from "vitest";
import type { StreamEventSchedulerEnv } from ".";
import { createStreamEventScheduler } from "./scheduler";

const TICK_MS = 250;

const event = (overrides: Partial<StreamEventConfig> = {}): StreamEventConfig => ({
  id: "go",
  enabled: true,
  scheduleMode: "interval",
  intervalSeconds: 90,
  offsetSeconds: 5,
  eventName: "sevent",
  targetURL: "http://app.example/it/default.ste",
  data: "",
  text: "GO",
  status: "trigger",
  ...overrides,
});

const channel = (streamEvents: ReadonlyArray<StreamEventConfig>): ChannelConfig => ({
  id: "dmax",
  name: "DMAX",
  mp4Source: "",
  onid: 12289,
  tsid: 516,
  sid: 10,
  enableStreamEvents: true,
  streamEvents: [...streamEvents],
});

const tuned = { onid: 12289, tsid: 516, sid: 10 } as unknown as OIPF.DAE.Broadcast.Channel;

/** A scheduler on a fake clock, starting at `startMs`; `advanceTo` runs its ticks up to a time. */
const scheduledPage = (startMs: number, events: ReadonlyArray<StreamEventConfig>) => {
  let nowMs = startMs;
  let pending: { at: number; run: () => void } | null = null;
  const env: StreamEventSchedulerEnv = {
    setTimeout: (io, delayMs) => () => {
      pending = { at: nowMs + delayMs, run: io };
      return 0 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: () => () => {
      pending = null;
    },
    now: () => nowMs,
    tickIntervalMs: TICK_MS,
    memoryRetentionMs: 5 * 60 * 1000,
    maxMemoryEntries: 2000,
  };
  const scheduler = createStreamEventScheduler([channel(events)], env);
  const fired: number[] = [];
  scheduler.start()();
  scheduler.setCurrentChannel(tuned)();
  scheduler.addListener(events[0]?.targetURL ?? "", "sevent", () => fired.push(nowMs))();
  return {
    scheduler,
    fired,
    advanceTo: (targetMs: number) => {
      while (pending !== null && pending.at <= targetMs) {
        const next: { at: number; run: () => void } = pending;
        pending = null;
        nowMs = next.at;
        next.run();
      }
      nowMs = targetMs;
    },
  };
};

/** Some time on air: a multiple of 90 s, plus 1 s. */
const ON_AIR_MS = 20_000_000 * 90_000 + 1_000;

describe("StreamEventScheduler", () => {
  it("fires on the channel's time, not from when the page loaded: 5 s past every 90 s of the channel", () => {
    const page = scheduledPage(ON_AIR_MS, [event()]);

    page.advanceTo(ON_AIR_MS + 200_000);

    expect(page.fired.map((at) => (at - ON_AIR_MS + 1_000) / 1_000)).toEqual([5, 95, 185]);
    expect(page.fired.every((at) => at % 90_000 >= 5_000 && at % 90_000 < 5_000 + TICK_MS)).toBe(true);
  });

  it("fires at the same moments in two pages that loaded at different times, as a broadcast does", () => {
    const first = scheduledPage(ON_AIR_MS, [event()]);
    const second = scheduledPage(ON_AIR_MS + 37_123, [event()]);

    first.advanceTo(ON_AIR_MS + 400_000);
    second.advanceTo(ON_AIR_MS + 400_000);

    // Each page ticks on its own (every 250 ms): the same occurrences, within a tick.
    const cycles = (fired: ReadonlyArray<number>) => fired.map((at) => Math.floor(at / 90_000));
    expect(second.fired.length).toBeGreaterThan(0);
    expect(cycles(second.fired)).toEqual(cycles(first.fired.filter((at) => at >= ON_AIR_MS + 37_123)));
    for (const at of second.fired) expect(at % 90_000).toBeGreaterThanOrEqual(5_000);
    for (const at of second.fired) expect(at % 90_000).toBeLessThan(5_000 + TICK_MS);
  });

  it("does not fire late what was due before the page loaded", () => {
    // Loaded 10 s after the event, 5 s past the 90 s.
    const page = scheduledPage(ON_AIR_MS + 14_000, [event()]);

    page.advanceTo(ON_AIR_MS + 80_000);

    expect(page.fired).toEqual([]);
  });

  it("stays on the channel's time across a channel change, without firing what was due before it", () => {
    const page = scheduledPage(ON_AIR_MS, [event()]);
    page.advanceTo(ON_AIR_MS + 10_000);
    expect(page.fired).toHaveLength(1);

    page.scheduler.setCurrentChannel(null)();
    page.advanceTo(ON_AIR_MS + 50_000);
    page.scheduler.setCurrentChannel(tuned)();
    page.advanceTo(ON_AIR_MS + 100_000);

    expect(page.fired.map((at) => (at - ON_AIR_MS + 1_000) / 1_000)).toEqual([5, 95]);
  });

  it("stops ticking when stopped", () => {
    const page = scheduledPage(ON_AIR_MS, [event()]);

    page.scheduler.stop()();
    page.advanceTo(ON_AIR_MS + 200_000);

    expect(page.fired).toEqual([]);
  });
});
