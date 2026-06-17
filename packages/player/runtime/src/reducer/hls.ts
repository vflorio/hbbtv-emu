import { match } from "ts-pattern";
import type { HLSVariantInfo } from "../model";
import { PlayerState } from "../states";
import type { ReduceResult } from "./types";

export const handleHLSManifestLoading = (state: PlayerState.Any, url: string): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => ({
      next: new PlayerState.Source.HLS.ManifestLoading(url),
      effects: [] as const,
    }))
    // Ignore if already in advanced states
    .otherwise(() => ({ next: state, effects: [] as const }));

export const handleHLSManifestParsed = (
  url: string,
  variants: readonly HLSVariantInfo[],
  duration: number,
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.HLS.ManifestParsed(url, variants, duration),
  effects: [] as const,
});

export const handleHLSVariantSelected = (
  variant: HLSVariantInfo,
  bandwidth: number,
  resolution: { width: number; height: number },
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.HLS.VariantSelected(variant, bandwidth, resolution),
  effects: [] as const,
});

export const handleHLSSegmentLoading = (
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

export const handleHLSAdaptiveSwitching = (
  fromVariant: HLSVariantInfo,
  toVariant: HLSVariantInfo,
  reason: "bandwidth" | "manual",
): ReduceResult<PlayerState.Any> => ({
  next: new PlayerState.Source.HLS.AdaptiveSwitching(fromVariant, toVariant, reason),
  effects: [] as const,
});
