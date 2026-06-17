import { match } from "ts-pattern";
import type { PlaybackType, ReduceResult } from "../model";
import { PlayerState, type SourceMetadata } from "../states";

export const handleMetadataLoaded = (
  state: PlayerState.Any,
  playbackType: PlaybackType,
  url: string,
  duration: number,
  width: number,
  height: number,
): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => {
      const resolution = { width, height };
      const source: SourceMetadata = {
        playbackType,
        url,
        resolution,
        codec: playbackType === "native" ? "unknown" : undefined,
      };
      return {
        next: new PlayerState.Control.Paused(0, duration, [], source),
        effects: [] as const,
      };
    })
    .with({ _tag: "Source/Native/ProgressiveLoading" }, () => {
      const resolution = { width, height };
      const source: SourceMetadata = {
        playbackType: "native",
        url,
        resolution,
        codec: "unknown",
      };
      return {
        next: new PlayerState.Control.Paused(0, duration, [], source),
        effects: [] as const,
      };
    })
    .with({ _tag: "Source/HLS/ManifestLoading" }, () => {
      const resolution = { width, height };
      const source: SourceMetadata = {
        playbackType: "hls",
        url,
        resolution,
      };
      return {
        next: new PlayerState.Control.Paused(0, duration, [], source),
        effects: [] as const,
      };
    })
    .with({ _tag: "Source/HLS/SegmentLoading" }, () => {
      const resolution = { width, height };
      const source: SourceMetadata = {
        playbackType: "hls",
        url,
        resolution,
      };
      return {
        next: new PlayerState.Control.Paused(0, duration, [], source),
        effects: [] as const,
      };
    })
    .with({ _tag: "Source/DASH/MPDLoading" }, () => {
      const resolution = { width, height };
      const source: SourceMetadata = {
        playbackType: "dash",
        url,
        resolution,
      };
      return {
        next: new PlayerState.Control.Paused(0, duration, [], source),
        effects: [] as const,
      };
    })
    .with({ _tag: "Source/DASH/SegmentDownloading" }, () => {
      const resolution = { width, height };
      const source: SourceMetadata = {
        playbackType: "dash",
        url,
        resolution,
      };
      return {
        next: new PlayerState.Control.Paused(0, duration, [], source),
        effects: [] as const,
      };
    })
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
