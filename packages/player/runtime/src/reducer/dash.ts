import { match } from "ts-pattern";
import { PlayerState } from "../";
import type { DASHAdaptationSetInfo, DASHRepresentationInfo, ReduceResult } from "../model";

export const handleDASHMPDLoading = (state: PlayerState.Any, url: string): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => ({
      next: new PlayerState.Source.DASH.MPDLoading(url),
      effects: [] as const,
    }))
    // Ignore if already in advanced states
    .otherwise(() => ({ next: state, effects: [] as const }));

export const handleDASHMPDParsed = (
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
      representationCount: as.representationCount,
    })),
    duration,
    isDynamic,
  ),
  effects: [] as const,
});

export const handleDASHRepresentationSelected = (
  representation: DASHRepresentationInfo,
  bandwidth: number,
  resolution: { width: number; height: number },
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.DASH.RepresentationSelected(representation, bandwidth, resolution),
  effects: [] as const,
});

export const handleDASHSegmentDownloading = (
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

export const handleDASHQualitySwitching = (
  fromRepresentation: DASHRepresentationInfo,
  toRepresentation: DASHRepresentationInfo,
  reason: "abr" | "manual" | "constraint",
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.DASH.QualitySwitching(fromRepresentation, toRepresentation, reason),
  effects: [] as const,
});
