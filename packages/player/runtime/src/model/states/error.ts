/**
 * Error States (Common errors across formats)
 */

import { FatalError, RecoverableError } from "./base";

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
