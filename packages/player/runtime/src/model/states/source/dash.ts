import type { DASHAdaptationSet, DASHRepresentation, Resolution } from "../../..";
import { PlayableState, RecoverableError } from "../base";

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
      readonly adaptationSets: readonly DASHAdaptationSet[],
      readonly duration: number,
      readonly isDynamic: boolean,
    ) {
      super();
    }
  }

  export class RepresentationSelected extends PlayableState {
    readonly _tag = "Source/DASH/RepresentationSelected" as const;

    constructor(
      readonly representation: DASHRepresentation,
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
      readonly fromRepresentation: DASHRepresentation,
      readonly toRepresentation: DASHRepresentation,
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
