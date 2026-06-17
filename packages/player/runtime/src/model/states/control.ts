import type { SourceMetadata, TimeRange } from "../common";
import { PlayableState, UnplayableState } from "./base";

export class Idle extends UnplayableState {
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
