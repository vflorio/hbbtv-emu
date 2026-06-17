import { match } from "ts-pattern";
import { PlayerState } from "../states";
import type { ReduceResult } from "./types";
import { detectPlaybackType } from "./types";

export const handleLoadIntent = (url: string): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Control.Loading(url, 0),
  effects: [
    { _tag: "Effect/DestroyAdapter" },
    { _tag: "Effect/CreateAdapter", playbackType: detectPlaybackType(url), url },
    { _tag: "Effect/AttachVideoElement" },
    { _tag: "Effect/LoadSource", url },
  ] as const,
});

export const handlePlayIntent = (state: PlayerState.Any): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Paused" }, (s) => ({
      next: new PlayerState.Control.Playing(s.currentTime, s.duration, s.buffered, 1.0, s.source),
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Control/Buffering" }, (s) => ({
      next: new PlayerState.Control.Playing(s.currentTime, s.duration, s.buffered, 1.0, s.source),
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Control/Ended" }, (s) => ({
      next: new PlayerState.Control.Playing(0, s.duration, [], 1.0),
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/Native/ProgressiveLoading" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/HLS/ManifestLoading" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/HLS/ManifestParsed" }, (s) => ({
      next: new PlayerState.Control.Playing(0, s.duration, [], 1.0),
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/HLS/SegmentLoading" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/HLS/VariantSelected" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/HLS/AdaptiveSwitching" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/DASH/MPDLoading" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/DASH/MPDParsed" }, (s) => ({
      next: new PlayerState.Control.Playing(0, s.duration, [], 1.0),
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/DASH/SegmentDownloading" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/DASH/RepresentationSelected" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .with({ _tag: "Source/DASH/QualitySwitching" }, () => ({
      next: state,
      effects: [{ _tag: "Effect/Play" }] as const,
    }))
    .otherwise(() => ({ next: state, effects: [] as const }));

export const handlePauseIntent = (state: PlayerState.Any): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Playing" }, (s) => ({
      next: new PlayerState.Control.Paused(s.currentTime, s.duration, s.buffered, s.source),
      effects: [{ _tag: "Effect/Pause" }] as const,
    }))
    .otherwise(() => ({ next: state, effects: [] as const }));

export const handleSeekIntent = (state: PlayerState.Any, time: number): ReduceResult<PlayerState.Any> =>
  match(state)
    .when(
      (s): s is Extract<PlayerState.Any, { currentTime: number; duration: number }> =>
        "currentTime" in s && "duration" in s && typeof s.duration === "number",
      (s) => ({
        next: new PlayerState.Control.Seeking(s.currentTime, time, s.duration),
        effects: [{ _tag: "Effect/Seek", time }] as const,
      }),
    )
    .otherwise(() => ({ next: state, effects: [] as const }));

export const handleSetVolumeIntent = (state: PlayerState.Any, volume: number): ReduceResult<PlayerState.Any> => ({
  next: state,
  effects: [{ _tag: "Effect/SetVolume", volume }] as const,
});

export const handleSetMutedIntent = (state: PlayerState.Any, muted: boolean): ReduceResult<PlayerState.Any> => ({
  next: state,
  effects: [{ _tag: "Effect/SetMuted", muted }] as const,
});
