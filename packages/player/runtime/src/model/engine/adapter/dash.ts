export interface DASHAdaptationSet {
  readonly id: string;
  readonly contentType: "video" | "audio" | "text";
  readonly mimeType: string;
  readonly representationCount: number;
}

export interface DASHRepresentation {
  readonly id: string;
  readonly bandwidth: number;
  readonly codecs: string;
  readonly resolution?: { width: number; height: number };
  readonly frameRate?: number;
}

export type PlayerEngineDashEvent =
  | {
      readonly _tag: "Engine/Adapter/DASH/MPDLoading";
      readonly url: string;
    }
  | {
      readonly _tag: "Engine/Adapter/DASH/MPDParsed";
      readonly url: string;
      readonly adaptationSets: readonly DASHAdaptationSet[];
      readonly duration: number;
      readonly isDynamic: boolean;
    }
  | {
      readonly _tag: "Engine/Adapter/DASH/RepresentationSelected";
      readonly representation: DASHRepresentation;
      readonly bandwidth: number;
      readonly resolution: { width: number; height: number };
    }
  | {
      readonly _tag: "Engine/Adapter/DASH/SegmentDownloading";
      readonly segmentIndex: number;
      readonly mediaType: "video" | "audio";
      readonly bytesLoaded: number;
      readonly bytesTotal: number;
    }
  | {
      readonly _tag: "Engine/Adapter/DASH/QualitySwitching";
      readonly fromRepresentation: DASHRepresentation;
      readonly toRepresentation: DASHRepresentation;
      readonly reason: "abr" | "manual" | "constraint";
    }
  | {
      readonly _tag: "Engine/Adapter/DASH/MPDParseError";
      readonly url: string;
      readonly retryCount: number;
      readonly message: string;
      readonly cause?: unknown;
    }
  | {
      readonly _tag: "Engine/Adapter/DASH/SegmentDownloadError";
      readonly segmentIndex: number;
      readonly mediaType: "video" | "audio";
      readonly retryCount: number;
      readonly message: string;
      readonly cause?: unknown;
    };
