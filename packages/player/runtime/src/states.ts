/**
 * Video Player State Management System (Class Discriminated Unions ADT)
 */

import type { PlaybackType } from "./types";

// ============================================================================
// Base Classes & Interfaces
// ============================================================================

/**
 * Base class for all valid operational states where playback can occur
 */
export abstract class PlayableState {
  readonly _tagGroup = "Playable" as const;
  readonly isError = false as const;
}

/**
 * Base class for errors that can potentially be recovered from
 */
export abstract class RecoverableError {
  readonly _tagGroup = "RecoverableError" as const;
  readonly isError = true as const;
  readonly canRetry = true as const;

  constructor(
    readonly error: Error,
    readonly retryCount: number = 0,
  ) {}
}

/**
 * Base class for fatal errors requiring user intervention
 */
export abstract class FatalError {
  readonly _tagGroup = "FatalError" as const;
  readonly isError = true as const;
  readonly canRetry = false as const;

  constructor(readonly error: Error) {}
}

/**
 * Media resolution information
 */
export interface Resolution {
  readonly width: number;
  readonly height: number;
}

/**
 * Time range for buffered content
 */
export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Source metadata for playback
 */
export interface SourceMetadata {
  readonly playbackType: PlaybackType;
  readonly url: string;
  readonly resolution?: Resolution;
  readonly codec?: string;
}

// ============================================================================
// Player State Namespace
// ============================================================================

export namespace PlayerState {
  // --------------------------------------------------------------------------
  // Control States (Common across all formats)
  // --------------------------------------------------------------------------

  export namespace Control {
    export class Idle extends PlayableState {
      readonly _tag = "Control/Idle" as const;
    }

    export class Loading extends PlayableState {
      readonly _tag = "Control/Loading" as const;

      constructor(
        readonly url: string,
        readonly progress: number = 0,
      ) {
        super();
      }
    }

    export class Playing extends PlayableState {
      readonly _tag = "Control/Playing" as const;

      constructor(
        readonly currentTime: number,
        readonly duration: number,
        readonly buffered: TimeRange[],
        readonly playbackRate: number = 1.0,
        readonly source?: SourceMetadata,
      ) {
        super();
      }
    }

    export class Paused extends PlayableState {
      readonly _tag = "Control/Paused" as const;

      constructor(
        readonly currentTime: number,
        readonly duration: number,
        readonly buffered: TimeRange[],
        readonly source?: SourceMetadata,
      ) {
        super();
      }
    }

    export class Buffering extends PlayableState {
      readonly _tag = "Control/Buffering" as const;

      constructor(
        readonly currentTime: number,
        readonly duration: number,
        readonly buffered: TimeRange[],
        readonly bufferProgress: number,
        readonly source?: SourceMetadata,
      ) {
        super();
      }
    }

    export class Seeking extends PlayableState {
      readonly _tag = "Control/Seeking" as const;

      constructor(
        readonly fromTime: number,
        readonly toTime: number,
        readonly duration: number,
      ) {
        super();
      }
    }

    export class Ended extends PlayableState {
      readonly _tag = "Control/Ended" as const;

      constructor(
        readonly duration: number,
        readonly wasLooping: boolean = false,
      ) {
        super();
      }
    }

    export type Any = Idle | Loading | Playing | Paused | Buffering | Seeking | Ended;
  }

  // --------------------------------------------------------------------------
  // Source-Specific States
  // --------------------------------------------------------------------------

  export namespace Source {
    // Native (Progressive) States
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

    // HLS (HTTP Live Streaming) States
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
          readonly variants: readonly HLSVariant[],
          readonly duration: number,
        ) {
          super();
        }
      }

      export class VariantSelected extends PlayableState {
        readonly _tag = "Source/HLS/VariantSelected" as const;

        constructor(
          readonly variant: HLSVariant,
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
          readonly fromVariant: HLSVariant,
          readonly toVariant: HLSVariant,
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

    // DASH (Dynamic Adaptive Streaming) States
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

    export type Any = Native.Any | HLS.Any | DASH.Any;
  }

  // --------------------------------------------------------------------------
  // Error States (Common errors across formats)
  // --------------------------------------------------------------------------

  export namespace Error {
    export class NetworkError extends RecoverableError {
      readonly _tag = "Error/Network" as const;

      constructor(
        error: Error,
        retryCount: number,
        readonly url: string,
        readonly statusCode?: number,
      ) {
        super(error, retryCount);
      }
    }

    export class NotSupportedError extends FatalError {
      readonly _tag = "Error/NotSupported" as const;

      constructor(
        error: Error,
        readonly mimeType: string,
        readonly codec?: string,
      ) {
        super(error);
      }
    }

    export class DRMError extends FatalError {
      readonly _tag = "Error/DRM" as const;

      constructor(
        error: Error,
        readonly keySystem: string,
        readonly errorCode: number,
      ) {
        super(error);
      }
    }

    export class AbortError extends RecoverableError {
      readonly _tag = "Error/Abort" as const;

      constructor(
        error: Error,
        readonly reason: string,
      ) {
        super(error, 0);
      }
    }

    export type Any = NetworkError | NotSupportedError | DRMError | AbortError;
  }

  // --------------------------------------------------------------------------
  // Top-Level Union Types
  // --------------------------------------------------------------------------

  /**
   * Complete union of all possible player states
   */
  export type Any = Control.Any | Source.Any | Error.Any;

  /**
   * Union of all playable states
   */
  export type Playable = Extract<Any, { _tagGroup: "Playable" }>;

  /**
   * Union of all error states
   */
  export type Errors = Extract<Any, { isError: true }>;

  /**
   * Union of all recoverable error states
   */
  export type RecoverableErrors = Extract<Any, { _tagGroup: "RecoverableError" }>;

  /**
   * Union of all fatal error states
   */
  export type FatalErrors = Extract<Any, { _tagGroup: "FatalError" }>;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface HLSVariant {
  readonly bandwidth: number;
  readonly resolution: Resolution;
  readonly codecs: string;
  readonly url: string;
  readonly frameRate?: number;
}

export interface DASHAdaptationSet {
  readonly id: string;
  readonly contentType: "video" | "audio" | "text";
  readonly mimeType: string;
  readonly representations: readonly DASHRepresentation[];
}

export interface DASHRepresentation {
  readonly id: string;
  readonly bandwidth: number;
  readonly codecs: string;
  readonly resolution?: Resolution;
  readonly frameRate?: number;
}
