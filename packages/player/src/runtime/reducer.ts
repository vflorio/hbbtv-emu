import { match } from "ts-pattern";
import type { PlaybackType } from "../playback/types";
import { PlayerState } from "../state/states";
import type { PlayerEvent, ReduceResult } from "./types";

export const initialState = (): PlayerState.Any => new PlayerState.Control.Idle();

export const reduce = (state: PlayerState.Any, event: PlayerEvent): ReduceResult<PlayerState.Any> =>
  match(event)
    .with({ _tag: "Intent/LoadRequested" }, ({ url }) => ({
      next: new PlayerState.Control.Loading(url, 0),
      effects: [
        { _tag: "Effect/DestroyAdapter" },
        { _tag: "Effect/CreateAdapter", playbackType: detectPlaybackType(url), url },
        { _tag: "Effect/AttachVideoElement" },
        { _tag: "Effect/LoadSource", url },
      ] as const,
    }))
    .with({ _tag: "Intent/PlayRequested" }, () =>
      match(state)
        .with({ _tag: "Control/Paused" }, (s) => ({
          next: new PlayerState.Control.Playing(s.currentTime, s.duration, s.buffered, 1.0),
          effects: [{ _tag: "Effect/Play" }] as const,
        }))
        .with({ _tag: "Control/Buffering" }, (s) => ({
          next: new PlayerState.Control.Playing(s.currentTime, s.duration, s.buffered, 1.0),
          effects: [{ _tag: "Effect/Play" }] as const,
        }))
        .with({ _tag: "Control/Ended" }, (s) => ({
          next: new PlayerState.Control.Playing(0, s.duration, [], 1.0),
          effects: [{ _tag: "Effect/Play" }] as const,
        }))
        .otherwise(() => ({ next: state, effects: [] as const })),
    )
    .with({ _tag: "Intent/PauseRequested" }, () =>
      match(state)
        .with({ _tag: "Control/Playing" }, (s) => ({
          next: new PlayerState.Control.Paused(s.currentTime, s.duration, s.buffered),
          effects: [{ _tag: "Effect/Pause" }] as const,
        }))
        .otherwise(() => ({ next: state, effects: [] as const })),
    )
    .with({ _tag: "Intent/SeekRequested" }, ({ time }) =>
      match(state)
        .when(
          (s): s is Extract<PlayerState.Any, { currentTime: number; duration: number }> =>
            "currentTime" in s && "duration" in s && typeof s.duration === "number",
          (s) => ({
            next: new PlayerState.Control.Seeking(s.currentTime, time, s.duration),
            effects: [{ _tag: "Effect/Seek", time }] as const,
          }),
        )
        .otherwise(() => ({ next: state, effects: [] as const })),
    )
    .with({ _tag: "Engine/MetadataLoaded" }, ({ url, duration, width, height }) =>
      match(state)
        .with({ _tag: "Control/Loading" }, () => ({
          next: new PlayerState.Source.MP4.Ready(url, duration, { width, height }, "unknown"),
          effects: [] as const,
        }))
        .otherwise(() => ({ next: state, effects: [] as const })),
    )
    .with({ _tag: "Engine/TimeUpdated" }, ({ snapshot }) =>
      match(state)
        .with({ _tag: "Control/Playing" }, () => ({
          next: new PlayerState.Control.Playing(
            snapshot.currentTime,
            snapshot.duration,
            snapshot.buffered,
            snapshot.playbackRate,
          ),
          effects: [] as const,
        }))
        .with({ _tag: "Control/Paused" }, () => ({
          next: new PlayerState.Control.Paused(snapshot.currentTime, snapshot.duration, snapshot.buffered),
          effects: [] as const,
        }))
        .with({ _tag: "Control/Buffering" }, (s) => ({
          next: new PlayerState.Control.Buffering(
            snapshot.currentTime,
            snapshot.duration,
            snapshot.buffered,
            s.bufferProgress,
          ),
          effects: [] as const,
        }))
        .with({ _tag: "Control/Seeking" }, (s) => ({
          next: new PlayerState.Control.Seeking(s.fromTime, s.toTime, snapshot.duration),
          effects: [] as const,
        }))
        .otherwise(() => ({ next: state, effects: [] as const })),
    )
    .with({ _tag: "Engine/Playing" }, ({ snapshot }) => ({
      next: new PlayerState.Control.Playing(
        snapshot.currentTime,
        snapshot.duration,
        snapshot.buffered,
        snapshot.playbackRate,
      ),
      effects: [] as const,
    }))
    .with({ _tag: "Engine/Paused" }, ({ snapshot }) => ({
      next: new PlayerState.Control.Paused(snapshot.currentTime, snapshot.duration, snapshot.buffered),
      effects: [] as const,
    }))
    .with({ _tag: "Engine/Waiting" }, ({ snapshot }) => ({
      next: new PlayerState.Control.Buffering(snapshot.currentTime, snapshot.duration, snapshot.buffered, 0),
      effects: [] as const,
    }))
    .with({ _tag: "Engine/Seeked" }, ({ snapshot }) => ({
      next: snapshot.paused
        ? new PlayerState.Control.Paused(snapshot.currentTime, snapshot.duration, snapshot.buffered)
        : new PlayerState.Control.Playing(
            snapshot.currentTime,
            snapshot.duration,
            snapshot.buffered,
            snapshot.playbackRate,
          ),
      effects: [] as const,
    }))
    .with({ _tag: "Engine/Ended" }, ({ snapshot }) => ({
      next: new PlayerState.Control.Ended(snapshot.duration, false),
      effects: [] as const,
    }))
    .with({ _tag: "Engine/Error" }, ({ kind, message, url }) =>
      match(kind)
        .with("not-supported", () => ({
          next: new PlayerState.Error.NotSupportedError(new Error(message), "unknown"),
          effects: [] as const,
        }))
        .with("network", () => ({
          next: new PlayerState.Error.NetworkError(new Error(message), 0, url ?? "unknown"),
          effects: [] as const,
        }))
        .otherwise(() => ({
          next: new PlayerState.Error.NetworkError(new Error(message), 0, url ?? "unknown"),
          effects: [] as const,
        })),
    )
    .otherwise(() => ({ next: state, effects: [] as const }));

const detectPlaybackType = (url: string): PlaybackType => {
  if (url.endsWith(".m3u8") || url.includes(".m3u8?")) return "hls";
  if (url.endsWith(".mpd") || url.includes(".mpd?")) return "dash";
  return "native";
};
