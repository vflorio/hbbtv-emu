import { type ChannelTriplet, createLogger, matchesChannelTriplet, toChannelTriplet } from "@hbb-emu/core";
import type { ChannelConfig, StreamEventConfig } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import type { StreamEventSchedulerApi, StreamEventSchedulerEnv, StreamEventSubscription } from "./";
import { computeDueStreamEvents, type FiredAtByInstanceId } from "./compute";

const logger = createLogger("StreamEventScheduler");

type ListenerEntry = Readonly<{
  targetURL: string;
  eventName: string;
  listener: OIPF.DAE.Broadcast.StreamEventListener;
}>;

const defaultStreamEventSchedulerEnv: StreamEventSchedulerEnv = {
  setTimeout: (io, delayMs) => () => setTimeout(() => io(), delayMs),
  clearTimeout: (handle) => () => clearTimeout(handle),
  now: () => Date.now(),
  tickIntervalMs: 250,
  memoryRetentionMs: 5 * 60 * 1000,
  maxMemoryEntries: 2000,
};

type StreamEventSchedulerState = {
  running: boolean;
  channels: ReadonlyArray<ChannelConfig>;
  currentTriplet: ChannelTriplet | null;
  tickTimer: ReturnType<typeof setTimeout> | null;
  baseTimeMs: number | null;
  lastTickMs: number | null;
  fired: FiredAtByInstanceId;
  listeners: Set<ListenerEntry>;
};

export class StreamEventScheduler implements StreamEventSchedulerApi {
  readonly #env: StreamEventSchedulerEnv;
  #state: StreamEventSchedulerState;

  constructor(
    initialChannels: ReadonlyArray<ChannelConfig>,
    env: StreamEventSchedulerEnv = defaultStreamEventSchedulerEnv,
  ) {
    this.#env = env;
    this.#state = {
      running: false,
      channels: [...initialChannels],
      currentTriplet: null,
      tickTimer: null,
      baseTimeMs: null,
      lastTickMs: null,
      fired: new Map(),
      listeners: new Set<ListenerEntry>(),
    };
  }

  readonly #clearTimers: IO.IO<void> = () => {
    const { tickTimer } = this.#state;
    if (!tickTimer) return;
    this.#env.clearTimeout(tickTimer)();
    this.#state.tickTimer = null;
  };

  readonly #resetCycleState: IO.IO<void> = () => {
    const nowMs = this.#env.now();
    this.#state.baseTimeMs = nowMs;
    this.#state.lastTickMs = null;
    this.#state.fired = new Map();
  };

  readonly #tick: IO.IO<void> = () => {
    if (!this.#state.running) return;

    const nowMs = this.#env.now();
    const baseTimeMs = this.#state.baseTimeMs ?? nowMs;
    this.#state.baseTimeMs = baseTimeMs;

    const windowStartMs = this.#state.lastTickMs ?? nowMs - this.#env.tickIntervalMs;
    this.#state.lastTickMs = nowMs;

    const channelTriplet = this.#state.currentTriplet;
    const channel = channelTriplet ? findCurrentChannelConfig(this.#state) : null;

    const shouldRun =
      !!channelTriplet &&
      !!channel &&
      channel.enableStreamEvents !== false &&
      (channel.streamEvents?.length ?? 0) > 0 &&
      this.#state.listeners.size > 0;

    if (!shouldRun) {
      this.#state.tickTimer = this.#env.setTimeout(this.#tick, this.#env.tickIntervalMs)();
      return;
    }

    const events = channel.streamEvents ?? [];
    const computed = computeDueStreamEvents({
      nowMs,
      windowStartMs,
      baseTimeMs,
      tickIntervalMs: this.#env.tickIntervalMs,
      events,
      fired: this.#state.fired,
      memoryRetentionMs: this.#env.memoryRetentionMs,
      maxMemoryEntries: this.#env.maxMemoryEntries,
    });

    this.#state.fired = computed.nextFired;

    if (computed.due.length > 0) {
      logger.debug("Dispatching stream events", {
        due: computed.due.length,
        listeners: this.#state.listeners.size,
      })();
    }

    for (const occ of computed.due) {
      dispatchToListeners(this.#state, occ.event)();
    }

    this.#state.tickTimer = this.#env.setTimeout(this.#tick, this.#env.tickIntervalMs)();
  };

  start: IO.IO<void> = () => {
    if (this.#state.running) return;
    this.#state.running = true;
    logger.info("Started")();
    this.#resetCycleState();
    this.#clearTimers();
    this.#state.tickTimer = this.#env.setTimeout(this.#tick, this.#env.tickIntervalMs)();
  };

  stop: IO.IO<void> = () => {
    if (!this.#state.running) return;
    this.#state.running = false;
    this.#clearTimers();
    logger.info("Stopped")();
  };

  updateChannels =
    (next: ReadonlyArray<ChannelConfig>): IO.IO<void> =>
    () => {
      this.#state.channels = [...next];
      logger.debug("Channels updated", { count: this.#state.channels.length })();
      // No immediate reschedule needed: tick loop continuously re-evaluates.
    };

  setCurrentChannel =
    (channel: OIPF.DAE.Broadcast.Channel | null): IO.IO<void> =>
    () => {
      const nextTriplet = channel ? toTriplet(channel) : null;
      const changed =
        (this.#state.currentTriplet?.onid ?? null) !== (nextTriplet?.onid ?? null) ||
        (this.#state.currentTriplet?.tsid ?? null) !== (nextTriplet?.tsid ?? null) ||
        (this.#state.currentTriplet?.sid ?? null) !== (nextTriplet?.sid ?? null);

      this.#state.currentTriplet = nextTriplet;
      logger.debug("Current channel updated", { changed, triplet: nextTriplet })();
      if (this.#state.running && changed) this.#resetCycleState();
    };

  addListener =
    (
      targetURL: string,
      eventName: string,
      listener: OIPF.DAE.Broadcast.StreamEventListener,
    ): IO.IO<StreamEventSubscription> =>
    () => {
      const entry: ListenerEntry = { targetURL, eventName, listener };
      this.#state.listeners.add(entry);

      return {
        unsubscribe: () => {
          this.#state.listeners.delete(entry);
        },
      };
    };
}

export const createStreamEventScheduler = (
  initialChannels: ReadonlyArray<ChannelConfig>,
  env: StreamEventSchedulerEnv = defaultStreamEventSchedulerEnv,
): StreamEventSchedulerApi => new StreamEventScheduler(initialChannels, env);

const findCurrentChannelConfig = (state: StreamEventSchedulerState): ChannelConfig | null => {
  if (!state.currentTriplet) return null;
  return state.channels.find(matchesTriplet(state.currentTriplet)) ?? null;
};

const dispatchToListeners =
  (state: StreamEventSchedulerState, eventConfig: StreamEventConfig): IO.IO<void> =>
  () => {
    const event = createStreamEvent(eventConfig);
    pipe(
      Array.from(state.listeners),
      RA.filter((entry) => entry.targetURL === eventConfig.targetURL && entry.eventName === eventConfig.eventName),
      RA.map(
        (entry): IO.IO<void> =>
          () => {
            try {
              entry.listener(event);
            } catch (error) {
              logger.warn("StreamEvent listener threw", error)();
            }
          },
      ),
      RA.sequence(IO.Applicative),
    )();
  };

const toTriplet = (channel: OIPF.DAE.Broadcast.Channel): ChannelTriplet | null =>
  pipe(toChannelTriplet(channel), O.toNullable);

const matchesTriplet =
  (triplet: ChannelTriplet) =>
  (config: ChannelConfig): boolean =>
    matchesChannelTriplet(triplet)({ onid: config.onid, tsid: config.tsid, sid: config.sid });

class StreamEvent extends Event implements OIPF.DAE.Broadcast.StreamEvent {
  readonly name: string;
  readonly data: string;
  readonly text: string;
  readonly status: "trigger" | "error";

  constructor(name: string, data: string, text: string = "", status: "trigger" | "error" = "trigger") {
    super("StreamEvent");

    this.name = name;
    this.data = data;
    this.text = text;
    this.status = status;
  }
}

export const createStreamEvent = (
  config: Pick<StreamEventConfig, "eventName" | "data" | "text" | "status">,
): OIPF.DAE.Broadcast.StreamEvent =>
  new StreamEvent(config.eventName, config.data, config.text ?? "", config.status ?? "trigger");
