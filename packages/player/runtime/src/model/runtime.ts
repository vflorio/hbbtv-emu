import type * as IO from "fp-ts/IO";
import type * as IOO from "fp-ts/IOOption";
import type * as T from "fp-ts/Task";
import type * as TE from "fp-ts/TaskEither";
import type { PlayerEvent, UnsubscribeFn } from ".";
import type { PlayerEventListener, PlayerStateListener } from "./";
import type { AdapterError, RuntimeAdapter } from "./adapter";
import type { PlaybackType } from "./playback";

export interface PlayerRuntimeApi<T> {
  getState: IO.IO<T>;
  getPlaybackType: IOO.IOOption<PlaybackType>;
  mount: (videoElement: HTMLVideoElement) => T.Task<void>;
  destroy: TE.TaskEither<PlayerRuntimeError, void>;
  dispatch: (event: PlayerEvent) => T.Task<void>;
  subscribeToState: (listener: PlayerStateListener<T>) => IO.IO<UnsubscribeFn>;
  subscribeToEvents: (listener: PlayerEventListener) => IO.IO<UnsubscribeFn>;
}

export type PlayerRuntimeError =
  | AdapterError
  | { readonly _tag: "RuntimeError/VideoElementMissing"; readonly message: string }
  | { readonly _tag: "RuntimeError/AdapterMissing"; readonly message: string }
  // TODO FIXME: la runtime deve ritornare direttamente un AdapterError
  | {
      readonly _tag: "RuntimeError/AdapterFailure";
      readonly operation: "mount" | "load" | "play" | "pause" | "seek" | "destroy";
      readonly message: string;
      readonly cause?: unknown;
    };

export type PlayerRuntimeConfig = Readonly<{
  readonly adapters: Record<PlaybackType, RuntimeAdapter>;
}>;
