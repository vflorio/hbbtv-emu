import type { ChannelConfig } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";

export * from "./compute";
export * from "./scheduler";

export type StreamEventSchedulerApi = Readonly<{
  start: IO.IO<void>;
  stop: IO.IO<void>;
  /** Updates channel configs (e.g. after settings change). */
  updateChannels: (channels: ReadonlyArray<ChannelConfig>) => IO.IO<void>;
  /** Sets the current tuned channel (as OIPF Channel); restarts schedule when it changes. */
  setCurrentChannel: (channel: OIPF.DAE.Broadcast.Channel | null) => IO.IO<void>;
  /** Registers a DSM-CC StreamEvent listener. Returns a subscription with an unsubscribe effect. */
  addListener: (
    targetURL: string,
    eventName: string,
    listener: OIPF.DAE.Broadcast.StreamEventListener,
  ) => IO.IO<StreamEventSubscription>;
}>;

export type StreamEventSubscription = Readonly<{
  unsubscribe: IO.IO<void>;
}>;

export type StreamEventSchedulerEnv = Readonly<{
  setTimeout: (io: IO.IO<void>, delayMs: number) => IO.IO<ReturnType<typeof setTimeout>>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => IO.IO<void>;
  now: IO.IO<number>;
  tickIntervalMs: number;
  memoryRetentionMs: number;
  maxMemoryEntries: number;
}>;
