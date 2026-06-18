import type { HLSVariant, Resolution } from "../../..";
import { PlayableState, RecoverableError } from "../base";

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
