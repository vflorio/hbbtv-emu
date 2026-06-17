/**
 * Source-Specific States
 */

import type { Resolution } from "../common";
import type { DASHAdaptationSetInfo, DASHRepresentationInfo } from "../engine/adapter/dash";
import type { HLSVariantInfo } from "../engine/adapter/hls";
import { FatalError, PlayableState, RecoverableError } from "./base";

// ============================================================================
// Native (Progressive) States
// ============================================================================

export namespace Native {
  export class ProgressiveLoading extends PlayableState {
    readonly _tag = "Source/Native/ProgressiveLoading" as const;

    constructor(
      readonly url: string,
      readonly bytesLoaded: number,
      readonly bytesTotal: number,
      readonly canPlayThrough: boolean,
    ) {
      super();
    }
  }

  export class DecodeError extends FatalError {
    readonly _tag = "Source/Native/DecodeError" as const;

    constructor(
      error: Error,
      readonly url: string,
      readonly codec: string,
    ) {
      super(error);
    }
  }

  export type Any = ProgressiveLoading | DecodeError;
}

// ============================================================================
// HLS (HTTP Live Streaming) States
// ============================================================================

export namespace HLS {
  export class ManifestLoading extends PlayableState {
    readonly _tag = "Source/HLS/ManifestLoading" as const;

    constructor(readonly url: string) {
      super();
    }
  }

  export class ManifestParsed extends PlayableState {
    readonly _tag = "Source/HLS/ManifestParsed" as const;

    constructor(
      readonly url: string,
      readonly variants: readonly HLSVariantInfo[],
      readonly duration: number,
    ) {
      super();
    }
  }

  export class VariantSelected extends PlayableState {
    readonly _tag = "Source/HLS/VariantSelected" as const;

    constructor(
      readonly variant: HLSVariantInfo,
      readonly bandwidth: number,
      readonly resolution: Resolution,
    ) {
      super();
    }
  }

  export class SegmentLoading extends PlayableState {
    readonly _tag = "Source/HLS/SegmentLoading" as const;

    constructor(
      readonly segmentIndex: number,
      readonly totalSegments: number,
      readonly currentTime: number,
    ) {
      super();
    }
  }

  export class AdaptiveSwitching extends PlayableState {
    readonly _tag = "Source/HLS/AdaptiveSwitching" as const;

    constructor(
      readonly fromVariant: HLSVariantInfo,
      readonly toVariant: HLSVariantInfo,
      readonly reason: "bandwidth" | "manual",
    ) {
      super();
    }
  }

  export class ManifestParseError extends RecoverableError {
    readonly _tag = "Source/HLS/ManifestParseError" as const;

    constructor(
      error: Error,
      retryCount: number,
      readonly url: string,
    ) {
      super(error, retryCount);
    }
  }

  export class SegmentLoadError extends RecoverableError {
    readonly _tag = "Source/HLS/SegmentLoadError" as const;

    constructor(
      error: Error,
      retryCount: number,
      readonly segmentIndex: number,
      readonly segmentUrl: string,
    ) {
      super(error, retryCount);
    }
  }

  export type Any =
    | ManifestLoading
    | ManifestParsed
    | VariantSelected
    | SegmentLoading
    | AdaptiveSwitching
    | ManifestParseError
    | SegmentLoadError;
}

// ============================================================================
// DASH (Dynamic Adaptive Streaming) States
// ============================================================================

export namespace DASH {
  export class MPDLoading extends PlayableState {
    readonly _tag = "Source/DASH/MPDLoading" as const;

    constructor(readonly url: string) {
      super();
    }
  }

  export class MPDParsed extends PlayableState {
    readonly _tag = "Source/DASH/MPDParsed" as const;

    constructor(
      readonly url: string,
      readonly adaptationSets: readonly DASHAdaptationSetInfo[],
      readonly duration: number,
      readonly isDynamic: boolean,
    ) {
      super();
    }
  }

  export class RepresentationSelected extends PlayableState {
    readonly _tag = "Source/DASH/RepresentationSelected" as const;

    constructor(
      readonly representation: DASHRepresentationInfo,
      readonly bandwidth: number,
      readonly resolution: Resolution,
    ) {
      super();
    }
  }

  export class SegmentDownloading extends PlayableState {
    readonly _tag = "Source/DASH/SegmentDownloading" as const;

    constructor(
      readonly segmentIndex: number,
      readonly mediaType: "video" | "audio",
      readonly bytesLoaded: number,
      readonly bytesTotal: number,
    ) {
      super();
    }
  }

  export class QualitySwitching extends PlayableState {
    readonly _tag = "Source/DASH/QualitySwitching" as const;

    constructor(
      readonly fromRepresentation: DASHRepresentationInfo,
      readonly toRepresentation: DASHRepresentationInfo,
      readonly reason: "abr" | "manual" | "constraint",
    ) {
      super();
    }
  }

  export class MPDParseError extends RecoverableError {
    readonly _tag = "Source/DASH/MPDParseError" as const;

    constructor(
      error: Error,
      retryCount: number,
      readonly url: string,
    ) {
      super(error, retryCount);
    }
  }

  export class SegmentDownloadError extends RecoverableError {
    readonly _tag = "Source/DASH/SegmentDownloadError" as const;

    constructor(
      error: Error,
      retryCount: number,
      readonly segmentIndex: number,
      readonly mediaType: "video" | "audio",
    ) {
      super(error, retryCount);
    }
  }

  export type Any =
    | MPDLoading
    | MPDParsed
    | RepresentationSelected
    | SegmentDownloading
    | QualitySwitching
    | MPDParseError
    | SegmentDownloadError;
}

export type Any = Native.Any | HLS.Any | DASH.Any;
