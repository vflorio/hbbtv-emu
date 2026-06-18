import { match } from "ts-pattern";
import { type PlaybackType, PlayerState, type ReduceResult } from "../model";

export const handleMetadataLoaded = (
  state: PlayerState.Any,
  playbackType: PlaybackType,
  url: string,
  duration: number,
  width: number,
  height: number,
): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => ({
      next: new PlayerState.Control.Paused(0, duration, [], {
        playbackType,
        url,
        resolution: { width, height },
        codec: playbackType === "native" ? "unknown" : undefined,
      }),
      effects: [] as const,
    }))
    .with({ _tag: "Source/Native/ProgressiveLoading" }, () => ({
      next: new PlayerState.Control.Paused(0, duration, [], {
        playbackType: "native",
        url,
        resolution: { width, height },
        codec: "unknown",
      }),
      effects: [] as const,
    }))
    .with({ _tag: "Source/HLS/ManifestLoading" }, () => ({
      next: new PlayerState.Control.Paused(0, duration, [], {
        playbackType: "hls",
        url,
        resolution: { width, height },
      }),
      effects: [] as const,
    }))
    .with({ _tag: "Source/HLS/SegmentLoading" }, () => ({
      next: new PlayerState.Control.Paused(0, duration, [], {
        playbackType: "hls",
        url,
        resolution: { width, height },
      }),
      effects: [] as const,
    }))
    .with({ _tag: "Source/DASH/MPDLoading" }, () => ({
      next: new PlayerState.Control.Paused(0, duration, [], {
        playbackType: "dash",
        url,
        resolution: { width, height },
      }),
      effects: [] as const,
    }))
    .with({ _tag: "Source/DASH/SegmentDownloading" }, () => ({
      next: new PlayerState.Control.Paused(0, duration, [], {
        playbackType: "dash",
        url,
        resolution: { width, height },
      }),
      effects: [] as const,
    }))
    .otherwise(() => ({ next: state, effects: [] as const }));

export const handleTimeUpdated = (
  state: PlayerState.Any,
  snapshot: {
    currentTime: number;
    duration: number;
    buffered: Array<{ start: number; end: number }>;
    playbackRate: number;
  },
): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Playing" }, (s) => ({
      next: new PlayerState.Control.Playing(
        snapshot.currentTime,
        snapshot.duration,
        snapshot.buffered,
        snapshot.playbackRate,
        s.source,
      ),
      effects: [] as const,
    }))
    .with({ _tag: "Control/Paused" }, (s) => ({
      next: new PlayerState.Control.Paused(snapshot.currentTime, snapshot.duration, snapshot.buffered, s.source),
      effects: [] as const,
    }))
    .with({ _tag: "Control/Buffering" }, (s) => ({
      next: new PlayerState.Control.Buffering(
        snapshot.currentTime,
        snapshot.duration,
        snapshot.buffered,
        s.bufferProgress,
        s.source,
      ),
      effects: [] as const,
    }))
    .with({ _tag: "Control/Seeking" }, (s) => ({
      next: new PlayerState.Control.Seeking(s.fromTime, s.toTime, snapshot.duration),
      effects: [] as const,
    }))
    // Transition transient source states back to Playing during playback
    .with({ _tag: "Source/HLS/VariantSelected" }, () => ({
      next: new PlayerState.Control.Playing(
        snapshot.currentTime,
        snapshot.duration,
        snapshot.buffered,
        snapshot.playbackRate,
      ),
      effects: [] as const,
    }))
    .with({ _tag: "Source/HLS/AdaptiveSwitching" }, () => ({
      next: new PlayerState.Control.Playing(
        snapshot.currentTime,
        snapshot.duration,
        snapshot.buffered,
        snapshot.playbackRate,
      ),
      effects: [] as const,
    }))
    .with({ _tag: "Source/DASH/RepresentationSelected" }, () => ({
      next: new PlayerState.Control.Playing(
        snapshot.currentTime,
        snapshot.duration,
        snapshot.buffered,
        snapshot.playbackRate,
      ),
      effects: [] as const,
    }))
    .with({ _tag: "Source/DASH/QualitySwitching" }, () => ({
      next: new PlayerState.Control.Playing(
        snapshot.currentTime,
        snapshot.duration,
        snapshot.buffered,
        snapshot.playbackRate,
      ),
      effects: [] as const,
    }))
    .otherwise(() => ({ next: state, effects: [] as const }));

export const handleEngineError = (
  kind: string,
  message: string,
  url?: string,
  codec?: string,
): ReduceResult<PlayerState.Any> =>
  match(kind)
    .with("not-supported", () => ({
      next: new PlayerState.Error.NotSupportedError(new Error(message), "unknown"),
      effects: [] as const,
    }))
    .with("network", () => ({
      next: new PlayerState.Error.NetworkError(new Error(message), 0, url ?? "unknown"),
      effects: [] as const,
    }))
    .with("decode", () => ({
      next: new PlayerState.Source.Native.DecodeError(new Error(message), url ?? "unknown", codec ?? "unknown"),
      effects: [] as const,
    }))
    .otherwise(() => ({
      next: new PlayerState.Error.NetworkError(new Error(message), 0, url ?? "unknown"),
      effects: [] as const,
    }));
