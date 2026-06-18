import { FatalError, PlayableState } from "../base";

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
