import { match } from "ts-pattern";
import { PlayerState, type SourceMetadata } from "./states";
import type {
  DASHAdaptationSetInfo,
  DASHRepresentationInfo,
  HLSVariantInfo,
  PlaybackType,
  PlayerEvent,
  ReduceResult,
} from "./types";

export const initialState = (): PlayerState.Any => new PlayerState.Control.Idle();

// ============================================================================
// Intent Handlers
// ============================================================================

const handleLoadIntent = (url: string): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Control.Loading(url, 0),
  effects: [
    { _tag: "Effect/DestroyAdapter" },
    { _tag: "Effect/CreateAdapter", playbackType: detectPlaybackType(url), url },
    { _tag: "Effect/AttachVideoElement" },
    { _tag: "Effect/LoadSource", url },
  ] as const,
});

const handlePlayIntent = (state: PlayerState.Any): ReduceResult<PlayerState.Any> =>
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

const handlePauseIntent = (state: PlayerState.Any): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Playing" }, (s) => ({
      next: new PlayerState.Control.Paused(s.currentTime, s.duration, s.buffered, s.source),
      effects: [{ _tag: "Effect/Pause" }] as const,
    }))
    .otherwise(() => ({ next: state, effects: [] as const }));

const handleSeekIntent = (state: PlayerState.Any, time: number): ReduceResult<PlayerState.Any> =>
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

const handleSetVolumeIntent = (state: PlayerState.Any, volume: number): ReduceResult<PlayerState.Any> => ({
  next: state,
  effects: [{ _tag: "Effect/SetVolume", volume }] as const,
});

const handleSetMutedIntent = (state: PlayerState.Any, muted: boolean): ReduceResult<PlayerState.Any> => ({
  next: state,
  effects: [{ _tag: "Effect/SetMuted", muted }] as const,
});

// ============================================================================
// Engine Core Events
// ============================================================================

const handleMetadataLoaded = (
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

const handleTimeUpdated = (
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

const handleEngineError = (
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

// ============================================================================
// Native Playback Events
// ============================================================================

const handleNativeProgressiveLoading = (
  state: PlayerState.Any,
  url: string,
  bytesLoaded: number,
  bytesTotal: number,
  canPlayThrough: boolean,
): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => ({
      next: new PlayerState.Source.Native.ProgressiveLoading(url, bytesLoaded, bytesTotal, canPlayThrough),
      effects: [] as const,
    }))
    .with({ _tag: "Source/Native/ProgressiveLoading" }, () => ({
      next: new PlayerState.Source.Native.ProgressiveLoading(url, bytesLoaded, bytesTotal, canPlayThrough),
      effects: [] as const,
    }))
    // Ignore ProgressiveLoading events when already in Ready or playing states
    .otherwise(() => ({ next: state, effects: [] as const }));

// ============================================================================
// HLS Events
// ============================================================================

const handleHLSManifestLoading = (state: PlayerState.Any, url: string): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => ({
      next: new PlayerState.Source.HLS.ManifestLoading(url),
      effects: [] as const,
    }))
    // Ignore if already in advanced states
    .otherwise(() => ({ next: state, effects: [] as const }));

const handleHLSManifestParsed = (
  url: string,
  variants: readonly HLSVariantInfo[],
  duration: number,
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.HLS.ManifestParsed(url, variants, duration),
  effects: [] as const,
});

const handleHLSVariantSelected = (
  variant: HLSVariantInfo,
  bandwidth: number,
  resolution: { width: number; height: number },
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.HLS.VariantSelected(variant, bandwidth, resolution),
  effects: [] as const,
});

const handleHLSSegmentLoading = (
  state: PlayerState.Any,
  segmentIndex: number,
  totalSegments: number,
  currentTime: number,
): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Source/HLS/ManifestParsed" }, () => ({
      next: new PlayerState.Source.HLS.SegmentLoading(segmentIndex, totalSegments, currentTime),
      effects: [] as const,
    }))
    .with({ _tag: "Source/HLS/SegmentLoading" }, () => ({
      next: new PlayerState.Source.HLS.SegmentLoading(segmentIndex, totalSegments, currentTime),
      effects: [] as const,
    }))
    // Ignore if already playing or in control states
    .otherwise(() => ({ next: state, effects: [] as const }));

const handleHLSAdaptiveSwitching = (
  fromVariant: HLSVariantInfo,
  toVariant: HLSVariantInfo,
  reason: "bandwidth" | "manual",
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.HLS.AdaptiveSwitching(fromVariant, toVariant, reason),
  effects: [] as const,
});

// ============================================================================
// DASH Events
// ============================================================================

const handleDASHMPDLoading = (state: PlayerState.Any, url: string): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => ({
      next: new PlayerState.Source.DASH.MPDLoading(url),
      effects: [] as const,
    }))
    // Ignore if already in advanced states
    .otherwise(() => ({ next: state, effects: [] as const }));

const handleDASHMPDParsed = (
  url: string,
  adaptationSets: readonly DASHAdaptationSetInfo[],
  duration: number,
  isDynamic: boolean,
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.DASH.MPDParsed(
    url,
    adaptationSets.map((as) => ({
      id: as.id,
      contentType: as.contentType,
      mimeType: as.mimeType,
      representations: [],
    })),
    duration,
    isDynamic,
  ),
  effects: [] as const,
});

const handleDASHRepresentationSelected = (
  representation: DASHRepresentationInfo,
  bandwidth: number,
  resolution: { width: number; height: number },
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.DASH.RepresentationSelected(representation, bandwidth, resolution),
  effects: [] as const,
});

const handleDASHSegmentDownloading = (
  state: PlayerState.Any,
  segmentIndex: number,
  mediaType: "video" | "audio",
  bytesLoaded: number,
  bytesTotal: number,
): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Source/DASH/MPDParsed" }, () => ({
      next: new PlayerState.Source.DASH.SegmentDownloading(segmentIndex, mediaType, bytesLoaded, bytesTotal),
      effects: [] as const,
    }))
    .with({ _tag: "Source/DASH/SegmentDownloading" }, () => ({
      next: new PlayerState.Source.DASH.SegmentDownloading(segmentIndex, mediaType, bytesLoaded, bytesTotal),
      effects: [] as const,
    }))
    // Ignore if already playing or in control states
    .otherwise(() => ({ next: state, effects: [] as const }));

const handleDASHQualitySwitching = (
  fromRepresentation: DASHRepresentationInfo,
  toRepresentation: DASHRepresentationInfo,
  reason: "abr" | "manual" | "constraint",
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.DASH.QualitySwitching(fromRepresentation, toRepresentation, reason),
  effects: [] as const,
});

// ============================================================================
// Main Reducer
// ============================================================================

export const reduce =
  (state: PlayerState.Any) =>
  (event: PlayerEvent): ReduceResult<PlayerState.Any> =>
    match(event)
      // Intent events
      .with({ _tag: "Intent/LoadRequested" }, ({ url }) => handleLoadIntent(url))
      .with({ _tag: "Intent/PlayRequested" }, () => handlePlayIntent(state))
      .with({ _tag: "Intent/PauseRequested" }, () => handlePauseIntent(state))
      .with({ _tag: "Intent/SeekRequested" }, ({ time }) => handleSeekIntent(state, time))
      .with({ _tag: "Intent/SetVolumeRequested" }, ({ volume }) => handleSetVolumeIntent(state, volume))
      .with({ _tag: "Intent/SetMutedRequested" }, ({ muted }) => handleSetMutedIntent(state, muted))
      // Engine core events
      .with({ _tag: "Engine/MetadataLoaded" }, ({ playbackType, url, duration, width, height }) =>
        handleMetadataLoaded(state, playbackType, url, duration, width, height),
      )
      .with({ _tag: "Engine/TimeUpdated" }, ({ snapshot }) => handleTimeUpdated(state, snapshot))
      .with({ _tag: "Engine/Playing" }, ({ snapshot }) => ({
        next: new PlayerState.Control.Playing(
          snapshot.currentTime,
          snapshot.duration,
          snapshot.buffered,
          snapshot.playbackRate,
          "source" in state ? state.source : undefined,
        ),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Paused" }, ({ snapshot }) => ({
        next: new PlayerState.Control.Paused(
          snapshot.currentTime,
          snapshot.duration,
          snapshot.buffered,
          "source" in state ? state.source : undefined,
        ),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Waiting" }, ({ snapshot }) => ({
        next: new PlayerState.Control.Buffering(
          snapshot.currentTime,
          snapshot.duration,
          snapshot.buffered,
          0,
          "source" in state ? state.source : undefined,
        ),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Seeked" }, ({ snapshot }) => ({
        next: snapshot.paused
          ? new PlayerState.Control.Paused(
              snapshot.currentTime,
              snapshot.duration,
              snapshot.buffered,
              "source" in state ? state.source : undefined,
            )
          : new PlayerState.Control.Playing(
              snapshot.currentTime,
              snapshot.duration,
              snapshot.buffered,
              snapshot.playbackRate,
              "source" in state ? state.source : undefined,
            ),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Ended" }, ({ snapshot }) => ({
        next: new PlayerState.Control.Ended(snapshot.duration, false),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/VolumeChanged" }, () => ({
        next: state,
        effects: [] as const,
      }))
      .with({ _tag: "Engine/MutedChanged" }, () => ({
        next: state,
        effects: [] as const,
      }))
      .with({ _tag: "Engine/AutoplayRecoveryAttempted" }, () => ({
        next: state,
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Error" }, ({ kind, message, url, codec }) => handleEngineError(kind, message, url, codec))
      // Native events
      .with({ _tag: "Engine/Native/ProgressiveLoading" }, ({ url, bytesLoaded, bytesTotal, canPlayThrough }) =>
        handleNativeProgressiveLoading(state, url, bytesLoaded, bytesTotal, canPlayThrough),
      )
      // HLS events
      .with({ _tag: "Engine/HLS/ManifestLoading" }, ({ url }) => handleHLSManifestLoading(state, url))
      .with({ _tag: "Engine/HLS/ManifestParsed" }, ({ url, variants, duration }) =>
        handleHLSManifestParsed(url, variants, duration),
      )
      .with({ _tag: "Engine/HLS/VariantSelected" }, ({ variant, bandwidth, resolution }) =>
        handleHLSVariantSelected(variant, bandwidth, resolution),
      )
      .with({ _tag: "Engine/HLS/SegmentLoading" }, ({ segmentIndex, totalSegments, currentTime }) =>
        handleHLSSegmentLoading(state, segmentIndex, totalSegments, currentTime),
      )
      .with({ _tag: "Engine/HLS/AdaptiveSwitching" }, ({ fromVariant, toVariant, reason }) =>
        handleHLSAdaptiveSwitching(fromVariant, toVariant, reason),
      )
      .with({ _tag: "Engine/HLS/ManifestParseError" }, ({ url, retryCount, message }) => ({
        next: new PlayerState.Source.HLS.ManifestParseError(new Error(message), retryCount, url),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/HLS/SegmentLoadError" }, ({ segmentIndex, segmentUrl, retryCount, message }) => ({
        next: new PlayerState.Source.HLS.SegmentLoadError(new Error(message), retryCount, segmentIndex, segmentUrl),
        effects: [] as const,
      }))
      // DASH events
      .with({ _tag: "Engine/DASH/MPDLoading" }, ({ url }) => handleDASHMPDLoading(state, url))
      .with({ _tag: "Engine/DASH/MPDParsed" }, ({ url, adaptationSets, duration, isDynamic }) =>
        handleDASHMPDParsed(url, adaptationSets, duration, isDynamic),
      )
      .with({ _tag: "Engine/DASH/RepresentationSelected" }, ({ representation, bandwidth, resolution }) =>
        handleDASHRepresentationSelected(representation, bandwidth, resolution),
      )
      .with({ _tag: "Engine/DASH/SegmentDownloading" }, ({ segmentIndex, mediaType, bytesLoaded, bytesTotal }) =>
        handleDASHSegmentDownloading(state, segmentIndex, mediaType, bytesLoaded, bytesTotal),
      )
      .with({ _tag: "Engine/DASH/QualitySwitching" }, ({ fromRepresentation, toRepresentation, reason }) =>
        handleDASHQualitySwitching(fromRepresentation, toRepresentation, reason),
      )
      .with({ _tag: "Engine/DASH/MPDParseError" }, ({ url, retryCount, message }) => ({
        next: new PlayerState.Source.DASH.MPDParseError(new Error(message), retryCount, url),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/DASH/SegmentDownloadError" }, ({ segmentIndex, mediaType, retryCount, message }) => ({
        next: new PlayerState.Source.DASH.SegmentDownloadError(new Error(message), retryCount, segmentIndex, mediaType),
        effects: [] as const,
      }))
      .otherwise(() => ({ next: state, effects: [] as const }));

// ============================================================================
// Utilities
// ============================================================================

const detectPlaybackType = (url: string): PlaybackType => {
  if (url.endsWith(".m3u8") || url.includes(".m3u8?")) return "hls";
  if (url.endsWith(".mpd") || url.includes(".mpd?")) return "dash";
  return "native";
};
