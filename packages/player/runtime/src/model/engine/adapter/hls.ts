export interface HLSVariant {
  readonly bandwidth: number;
  readonly resolution: { width: number; height: number };
  readonly codecs: string;
  readonly url: string;
  readonly frameRate?: number;
}

export type PlayerEngineHlsEvent =
  | {
      readonly _tag: "Engine/Adapter/HLS/ManifestLoading";
      readonly url: string;
    }
  | {
      readonly _tag: "Engine/Adapter/HLS/ManifestParsed";
      readonly url: string;
      readonly variants: readonly HLSVariant[];
      readonly duration: number;
    }
  | {
      readonly _tag: "Engine/Adapter/HLS/VariantSelected";
      readonly variant: HLSVariant;
      readonly bandwidth: number;
      readonly resolution: { width: number; height: number };
    }
  | {
      readonly _tag: "Engine/Adapter/HLS/SegmentLoading";
      readonly segmentIndex: number;
      readonly totalSegments: number;
      readonly currentTime: number;
    }
  | {
      readonly _tag: "Engine/Adapter/HLS/AdaptiveSwitching";
      readonly fromVariant: HLSVariant;
      readonly toVariant: HLSVariant;
      readonly reason: "bandwidth" | "manual";
    }
  | {
      readonly _tag: "Engine/Adapter/HLS/ManifestParseError";
      readonly url: string;
      readonly retryCount: number;
      readonly message: string;
      readonly cause?: unknown;
    }
  | {
      readonly _tag: "Engine/Adapter/HLS/SegmentLoadError";
      readonly segmentIndex: number;
      readonly segmentUrl: string;
      readonly retryCount: number;
      readonly message: string;
      readonly cause?: unknown;
    };
