import { match } from "ts-pattern";
import { PlayerState } from "./states";
import type { PlaybackType, PlayerEvent, ReduceResult } from "./types";

export const initialState = (): PlayerState.Any => new PlayerState.Control.Idle();

export const reduce =
  (state: PlayerState.Any) =>
  (event: PlayerEvent): ReduceResult<PlayerState.Any> =>
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
          .with({ _tag: "Source/Native/Ready" }, (s) => ({
            next: new PlayerState.Control.Playing(0, s.duration, [], 1.0),
            effects: [{ _tag: "Effect/Play" }] as const,
          }))
          .with({ _tag: "Source/Native/ProgressiveLoading" }, () => ({
            next: state,
            effects: [{ _tag: "Effect/Play" }] as const,
          }))
          .with({ _tag: "Source/HLS/Ready" }, (s) => ({
            next: new PlayerState.Control.Playing(0, s.duration, [], 1.0),
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
          .with({ _tag: "Source/DASH/Ready" }, (s) => ({
            next: new PlayerState.Control.Playing(0, s.duration, [], 1.0),
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
      .with({ _tag: "Engine/MetadataLoaded" }, ({ playbackType, url, duration, width, height }) =>
        match(state)
          .with({ _tag: "Control/Loading" }, () => {
            const resolution = { width, height };

            const nextState = match(playbackType)
              .with("native", () => new PlayerState.Source.Native.Ready(url, duration, resolution, "unknown"))
              .with("hls", () => new PlayerState.Source.HLS.Ready(url, duration, resolution))
              .with("dash", () => new PlayerState.Source.DASH.Ready(url, duration, resolution))
              .exhaustive();

            return {
              next: nextState,
              effects: [] as const,
            };
          })
          .with({ _tag: "Source/Native/ProgressiveLoading" }, () => {
            const resolution = { width, height };
            return {
              next: new PlayerState.Source.Native.Ready(url, duration, resolution, "unknown"),
              effects: [] as const,
            };
          })
          .with({ _tag: "Source/HLS/ManifestLoading" }, () => {
            const resolution = { width, height };
            return {
              next: new PlayerState.Source.HLS.Ready(url, duration, resolution),
              effects: [] as const,
            };
          })
          .with({ _tag: "Source/HLS/SegmentLoading" }, () => {
            const resolution = { width, height };
            return {
              next: new PlayerState.Source.HLS.Ready(url, duration, resolution),
              effects: [] as const,
            };
          })
          .with({ _tag: "Source/DASH/MPDLoading" }, () => {
            const resolution = { width, height };
            return {
              next: new PlayerState.Source.DASH.Ready(url, duration, resolution),
              effects: [] as const,
            };
          })
          .with({ _tag: "Source/DASH/SegmentDownloading" }, () => {
            const resolution = { width, height };
            return {
              next: new PlayerState.Source.DASH.Ready(url, duration, resolution),
              effects: [] as const,
            };
          })
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
      .with({ _tag: "Engine/Error" }, ({ kind, message, url, codec }) =>
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
          })),
      )
      // Native-specific events
      .with({ _tag: "Engine/Native/ProgressiveLoading" }, ({ url, bytesLoaded, bytesTotal, canPlayThrough }) =>
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
          .otherwise(() => ({ next: state, effects: [] as const })),
      )
      // HLS-specific events
      .with({ _tag: "Engine/HLS/ManifestLoading" }, ({ url }) =>
        match(state)
          .with({ _tag: "Control/Loading" }, () => ({
            next: new PlayerState.Source.HLS.ManifestLoading(url),
            effects: [] as const,
          }))
          // Ignore if already in advanced states
          .otherwise(() => ({ next: state, effects: [] as const })),
      )
      .with({ _tag: "Engine/HLS/ManifestParsed" }, ({ url, variants, duration }) => {
        const hlsVariants = variants.map((v) => ({
          bandwidth: v.bandwidth,
          resolution: v.resolution,
          codecs: v.codecs,
          url: v.url,
          frameRate: v.frameRate,
        }));
        return {
          next: new PlayerState.Source.HLS.ManifestParsed(url, hlsVariants, duration),
          effects: [] as const,
        };
      })
      .with({ _tag: "Engine/HLS/VariantSelected" }, ({ variant, bandwidth, resolution }) => {
        const hlsVariant = {
          bandwidth: variant.bandwidth,
          resolution: variant.resolution,
          codecs: variant.codecs,
          url: variant.url,
          frameRate: variant.frameRate,
        };
        return {
          next: new PlayerState.Source.HLS.VariantSelected(hlsVariant, bandwidth, resolution),
          effects: [] as const,
        };
      })
      .with({ _tag: "Engine/HLS/SegmentLoading" }, ({ segmentIndex, totalSegments, currentTime }) =>
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
          .otherwise(() => ({ next: state, effects: [] as const })),
      )
      .with({ _tag: "Engine/HLS/AdaptiveSwitching" }, ({ fromVariant, toVariant, reason }) => {
        const from = {
          bandwidth: fromVariant.bandwidth,
          resolution: fromVariant.resolution,
          codecs: fromVariant.codecs,
          url: fromVariant.url,
          frameRate: fromVariant.frameRate,
        };
        const to = {
          bandwidth: toVariant.bandwidth,
          resolution: toVariant.resolution,
          codecs: toVariant.codecs,
          url: toVariant.url,
          frameRate: toVariant.frameRate,
        };
        return {
          next: new PlayerState.Source.HLS.AdaptiveSwitching(from, to, reason),
          effects: [] as const,
        };
      })
      .with({ _tag: "Engine/HLS/ManifestParseError" }, ({ url, retryCount, message }) => ({
        next: new PlayerState.Source.HLS.ManifestParseError(new Error(message), retryCount, url),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/HLS/SegmentLoadError" }, ({ segmentIndex, segmentUrl, retryCount, message }) => ({
        next: new PlayerState.Source.HLS.SegmentLoadError(new Error(message), retryCount, segmentIndex, segmentUrl),
        effects: [] as const,
      }))
      // DASH-specific events
      .with({ _tag: "Engine/DASH/MPDLoading" }, ({ url }) =>
        match(state)
          .with({ _tag: "Control/Loading" }, () => ({
            next: new PlayerState.Source.DASH.MPDLoading(url),
            effects: [] as const,
          }))
          // Ignore if already in advanced states
          .otherwise(() => ({ next: state, effects: [] as const })),
      )
      .with({ _tag: "Engine/DASH/MPDParsed" }, ({ url, adaptationSets, duration, isDynamic }) => {
        const dashAdaptationSets = adaptationSets.map((as) => ({
          id: as.id,
          contentType: as.contentType,
          mimeType: as.mimeType,
          representations: [], // We don't have full representation data at this point
        }));
        return {
          next: new PlayerState.Source.DASH.MPDParsed(url, dashAdaptationSets, duration, isDynamic),
          effects: [] as const,
        };
      })
      .with({ _tag: "Engine/DASH/RepresentationSelected" }, ({ representation, bandwidth, resolution }) => {
        const dashRepresentation = {
          id: representation.id,
          bandwidth: representation.bandwidth,
          codecs: representation.codecs,
          resolution: representation.resolution,
          frameRate: representation.frameRate,
        };
        return {
          next: new PlayerState.Source.DASH.RepresentationSelected(dashRepresentation, bandwidth, resolution),
          effects: [] as const,
        };
      })
      .with({ _tag: "Engine/DASH/SegmentDownloading" }, ({ segmentIndex, mediaType, bytesLoaded, bytesTotal }) =>
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
          .otherwise(() => ({ next: state, effects: [] as const })),
      )
      .with({ _tag: "Engine/DASH/QualitySwitching" }, ({ fromRepresentation, toRepresentation, reason }) => {
        const from = {
          id: fromRepresentation.id,
          bandwidth: fromRepresentation.bandwidth,
          codecs: fromRepresentation.codecs,
          resolution: fromRepresentation.resolution,
          frameRate: fromRepresentation.frameRate,
        };
        const to = {
          id: toRepresentation.id,
          bandwidth: toRepresentation.bandwidth,
          codecs: toRepresentation.codecs,
          resolution: toRepresentation.resolution,
          frameRate: toRepresentation.frameRate,
        };
        return {
          next: new PlayerState.Source.DASH.QualitySwitching(from, to, reason),
          effects: [] as const,
        };
      })
      .with({ _tag: "Engine/DASH/MPDParseError" }, ({ url, retryCount, message }) => ({
        next: new PlayerState.Source.DASH.MPDParseError(new Error(message), retryCount, url),
        effects: [] as const,
      }))
      .with({ _tag: "Engine/DASH/SegmentDownloadError" }, ({ segmentIndex, mediaType, retryCount, message }) => ({
        next: new PlayerState.Source.DASH.SegmentDownloadError(new Error(message), retryCount, segmentIndex, mediaType),
        effects: [] as const,
      }))
      .otherwise(() => ({ next: state, effects: [] as const }));

const detectPlaybackType = (url: string): PlaybackType => {
  if (url.endsWith(".m3u8") || url.includes(".m3u8?")) return "hls";
  if (url.endsWith(".mpd") || url.includes(".mpd?")) return "dash";
  return "native";
};
