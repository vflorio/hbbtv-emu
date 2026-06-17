import { match } from "ts-pattern";
import { type PlayerEvent, PlayerState, type ReduceResult } from "../model";
import {
  handleDASHMPDLoading,
  handleDASHMPDParsed,
  handleDASHQualitySwitching,
  handleDASHRepresentationSelected,
  handleDASHSegmentDownloading,
} from "./dash";
import { handleEngineError, handleMetadataLoaded, handleTimeUpdated } from "./engine";
import {
  handleHLSAdaptiveSwitching,
  handleHLSManifestLoading,
  handleHLSManifestParsed,
  handleHLSSegmentLoading,
  handleHLSVariantSelected,
} from "./hls";
import {
  handleLoadIntent,
  handlePauseIntent,
  handlePlayIntent,
  handleSeekIntent,
  handleSetMutedIntent,
  handleSetVolumeIntent,
} from "./intents";
import { handleNativeProgressiveLoading } from "./native";

export const initialState = (): PlayerState.Any => new PlayerState.Control.Idle();

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
      .with({ _tag: "Engine/Core/MetadataLoaded" }, ({ playbackType, url, duration, width, height }) =>
        handleMetadataLoaded(state, playbackType, url, duration, width, height),
      )
      .with({ _tag: "Engine/Core/TimeUpdated" }, ({ snapshot }) => handleTimeUpdated(state, snapshot))
      .with({ _tag: "Engine/Core/Playing" }, ({ snapshot }) => ({
        next: new PlayerState.Control.Playing(
          snapshot.currentTime,
          snapshot.duration,
          snapshot.buffered,
          snapshot.playbackRate,
          "source" in state ? state.source : undefined,
        ),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Core/Paused" }, ({ snapshot }) => ({
        next: new PlayerState.Control.Paused(
          snapshot.currentTime,
          snapshot.duration,
          snapshot.buffered,
          "source" in state ? state.source : undefined,
        ),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Core/Waiting" }, ({ snapshot }) => ({
        next: new PlayerState.Control.Buffering(
          snapshot.currentTime,
          snapshot.duration,
          snapshot.buffered,
          0,
          "source" in state ? state.source : undefined,
        ),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Core/Seeked" }, ({ snapshot }) => ({
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
      .with({ _tag: "Engine/Core/Ended" }, ({ snapshot }) => ({
        next: new PlayerState.Control.Ended(snapshot.duration, false),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Core/VolumeChanged" }, () => ({
        next: state,
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Core/MutedChanged" }, () => ({
        next: state,
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Core/AutoplayRecoveryAttempted" }, () => ({
        next: state,
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Error" }, ({ kind, message, url, codec }) => handleEngineError(kind, message, url, codec))
      // Native events
      .with({ _tag: "Engine/Adapter/Native/ProgressiveLoading" }, ({ url, bytesLoaded, bytesTotal, canPlayThrough }) =>
        handleNativeProgressiveLoading(state, url, bytesLoaded, bytesTotal, canPlayThrough),
      )
      // HLS events
      .with({ _tag: "Engine/Adapter/HLS/ManifestLoading" }, ({ url }) => handleHLSManifestLoading(state, url))
      .with({ _tag: "Engine/Adapter/HLS/ManifestParsed" }, ({ url, variants, duration }) =>
        handleHLSManifestParsed(url, variants, duration),
      )
      .with({ _tag: "Engine/Adapter/HLS/VariantSelected" }, ({ variant, bandwidth, resolution }) =>
        handleHLSVariantSelected(variant, bandwidth, resolution),
      )
      .with({ _tag: "Engine/Adapter/HLS/SegmentLoading" }, ({ segmentIndex, totalSegments, currentTime }) =>
        handleHLSSegmentLoading(state, segmentIndex, totalSegments, currentTime),
      )
      .with({ _tag: "Engine/Adapter/HLS/AdaptiveSwitching" }, ({ fromVariant, toVariant, reason }) =>
        handleHLSAdaptiveSwitching(fromVariant, toVariant, reason),
      )
      .with({ _tag: "Engine/Adapter/HLS/ManifestParseError" }, ({ url, retryCount, message }) => ({
        next: new PlayerState.Source.HLS.ManifestParseError(new Error(message), retryCount, url),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/Adapter/HLS/SegmentLoadError" }, ({ segmentIndex, segmentUrl, retryCount, message }) => ({
        next: new PlayerState.Source.HLS.SegmentLoadError(new Error(message), retryCount, segmentIndex, segmentUrl),
        effects: [] as const,
      }))
      // DASH events
      .with({ _tag: "Engine/Adapter/DASH/MPDLoading" }, ({ url }) => handleDASHMPDLoading(state, url))
      .with({ _tag: "Engine/Adapter/DASH/MPDParsed" }, ({ url, adaptationSets, duration, isDynamic }) =>
        handleDASHMPDParsed(url, adaptationSets, duration, isDynamic),
      )
      .with({ _tag: "Engine/Adapter/DASH/RepresentationSelected" }, ({ representation, bandwidth, resolution }) =>
        handleDASHRepresentationSelected(representation, bandwidth, resolution),
      )
      .with(
        { _tag: "Engine/Adapter/DASH/SegmentDownloading" },
        ({ segmentIndex, mediaType, bytesLoaded, bytesTotal }) =>
          handleDASHSegmentDownloading(state, segmentIndex, mediaType, bytesLoaded, bytesTotal),
      )
      .with({ _tag: "Engine/Adapter/DASH/QualitySwitching" }, ({ fromRepresentation, toRepresentation, reason }) =>
        handleDASHQualitySwitching(fromRepresentation, toRepresentation, reason),
      )
      .with({ _tag: "Engine/Adapter/DASH/MPDParseError" }, ({ url, retryCount, message }) => ({
        next: new PlayerState.Source.DASH.MPDParseError(new Error(message), retryCount, url),
        effects: [] as const,
      }))
      .with(
        { _tag: "Engine/Adapter/DASH/SegmentDownloadError" },
        ({ segmentIndex, mediaType, retryCount, message }) => ({
          next: new PlayerState.Source.DASH.SegmentDownloadError(
            new Error(message),
            retryCount,
            segmentIndex,
            mediaType,
          ),
          effects: [] as const,
        }),
      )
      .otherwise(() => ({ next: state, effects: [] as const }));
