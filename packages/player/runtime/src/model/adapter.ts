import type * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";
import type { PlayerEvent, UnsubscribeFn } from "..";
import type { PlaybackType } from "./playback";

export type RuntimeAdapter = {
  readonly type: PlaybackType;
  mount: (videoElement: HTMLVideoElement) => IO.IO<void>;
  load: (url: string) => TE.TaskEither<AdapterError, void>;
  play: TE.TaskEither<AdapterError, void>;
  pause: TE.TaskEither<AdapterError, void>;
  seek: (time: number) => TE.TaskEither<AdapterError, void>;
  setVolume: (volume: number) => TE.TaskEither<AdapterError, void>;
  setMuted: (muted: boolean) => TE.TaskEither<AdapterError, void>;
  destroy: TE.TaskEither<AdapterError, void>;
  subscribe: (listener: (event: PlayerEvent) => void) => IO.IO<UnsubscribeFn>;
};

export type AdapterError =
  | {
      readonly _tag: "AdapterError/LoadFailed";
      readonly message: string;
      readonly url: string;
      readonly cause?: unknown;
    }
  | { readonly _tag: "AdapterError/PlayFailed"; readonly message: string; readonly cause?: unknown }
  | { readonly _tag: "AdapterError/AutoplayBlocked"; readonly message: string; readonly cause?: unknown }
  | { readonly _tag: "AdapterError/PauseFailed"; readonly message: string; readonly cause?: unknown }
  | {
      readonly _tag: "AdapterError/SeekFailed";
      readonly message: string;
      readonly time: number;
      readonly cause?: unknown;
    }
  | { readonly _tag: "AdapterError/DestroyFailed"; readonly message: string; readonly cause?: unknown }
  | { readonly _tag: "AdapterError/NotSupported"; readonly message: string; readonly adapterType: string };
