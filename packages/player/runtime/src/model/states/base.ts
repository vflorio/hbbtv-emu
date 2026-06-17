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
