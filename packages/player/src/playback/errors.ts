/**
 * Playback Error System
 *
 * Typed errors for playback operations using discriminated unions
 * instead of exceptions, following fp-ts patterns.
 */

import type { Playback } from "./factory";

// ============================================================================
// Error Base Classes
// ============================================================================

/**
 * Base class for all playback errors
 */
export abstract class PlaybackError extends Error {
  abstract readonly _tag: string;
  abstract readonly _errorGroup: "Recoverable" | "Fatal";
  readonly timestamp: number = Date.now();

  constructor(
    message: string,
    readonly playback?: Playback.Any,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Errors that can potentially be recovered from (retry, fallback)
 */
export abstract class RecoverablePlaybackError extends PlaybackError {
  readonly _errorGroup = "Recoverable" as const;

  constructor(
    message: string,
    playback?: Playback.Any,
    cause?: unknown,
    readonly retryCount: number = 0,
  ) {
    super(message, playback, cause);
  }
}

/**
 * Fatal errors requiring user intervention or abandoning playback
 */
export abstract class FatalPlaybackError extends PlaybackError {
  readonly _errorGroup = "Fatal" as const;

  constructor(message: string, playback?: Playback.Any, cause?: unknown) {
    super(message, playback, cause);
  }
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Engine initialization failed
 */
export class InitializationError extends RecoverablePlaybackError {
  readonly _tag = "InitializationError" as const;

  constructor(message: string, playback: Playback.Any, cause?: unknown, retryCount = 0) {
    super(message, playback, cause, retryCount);
  }
}

/**
 * Failed to load media source
 */
export class LoadError extends RecoverablePlaybackError {
  readonly _tag = "LoadError" as const;

  constructor(
    message: string,
    readonly source: string,
    playback?: Playback.Any,
    cause?: unknown,
    retryCount = 0,
  ) {
    super(message, playback, cause, retryCount);
  }
}

/**
 * Playback engine not supported in this environment
 */
export class EngineNotSupportedError extends FatalPlaybackError {
  readonly _tag = "EngineNotSupportedError" as const;

  constructor(
    readonly engineName: string,
    readonly reason: string,
    playback?: Playback.Any,
  ) {
    super(`Engine ${engineName} not supported: ${reason}`, playback);
  }
}

/**
 * Network error during loading or streaming
 */
export class NetworkError extends RecoverablePlaybackError {
  readonly _tag = "NetworkError" as const;

  constructor(
    readonly url: string,
    readonly statusCode?: number,
    playback?: Playback.Any,
    cause?: unknown,
    retryCount = 0,
  ) {
    super(
      statusCode ? `Network error (${statusCode}) loading ${url}` : `Network error loading ${url}`,
      playback,
      cause,
      retryCount,
    );
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * Media decoding error
 */
export class DecodeError extends FatalPlaybackError {
  readonly _tag = "DecodeError" as const;

  constructor(
    readonly codec?: string,
    playback?: Playback.Any,
    cause?: unknown,
  ) {
    super(codec ? `Decode error for codec: ${codec}` : "Media decode error", playback, cause);
  }
}

/**
 * DRM/encryption error
 */
export class DRMError extends FatalPlaybackError {
  readonly _tag = "DRMError" as const;

  constructor(
    readonly keySystem: string,
    readonly errorCode: string,
    playback?: Playback.Any,
    cause?: unknown,
  ) {
    super(`DRM error (${keySystem}): ${errorCode}`, playback, cause);
  }
}

/**
 * Format or codec not supported
 */
export class NotSupportedError extends FatalPlaybackError {
  readonly _tag = "NotSupportedError" as const;

  constructor(
    readonly mimeType: string,
    readonly codec?: string,
    playback?: Playback.Any,
  ) {
    super(
      codec ? `Format not supported: ${mimeType} (codec: ${codec})` : `Format not supported: ${mimeType}`,
      playback,
    );
  }
}

/**
 * Playback was aborted
 */
export class AbortError extends RecoverablePlaybackError {
  readonly _tag = "AbortError" as const;

  constructor(
    readonly reason: string,
    playback?: Playback.Any,
    cause?: unknown,
  ) {
    super(`Playback aborted: ${reason}`, playback, cause, 0);
  }
}

/**
 * Failed to create playback instance
 */
export class CreationError extends FatalPlaybackError {
  readonly _tag = "CreationError" as const;

  constructor(
    readonly sourceType: string,
    message: string,
    cause?: unknown,
  ) {
    super(`Failed to create ${sourceType} playback: ${message}`, undefined, cause);
  }
}

/**
 * HLS-specific manifest parse error
 */
export class HLSManifestError extends RecoverablePlaybackError {
  readonly _tag = "HLSManifestError" as const;

  constructor(
    readonly manifestUrl: string,
    playback?: Playback.Any,
    cause?: unknown,
    retryCount = 0,
  ) {
    super(`Failed to parse HLS manifest: ${manifestUrl}`, playback, cause, retryCount);
  }
}

/**
 * HLS-specific fragment load error
 */
export class HLSFragmentError extends RecoverablePlaybackError {
  readonly _tag = "HLSFragmentError" as const;

  constructor(
    readonly fragmentUrl: string,
    readonly fragmentIndex: number,
    playback?: Playback.Any,
    cause?: unknown,
    retryCount = 0,
  ) {
    super(`Failed to load HLS fragment ${fragmentIndex}: ${fragmentUrl}`, playback, cause, retryCount);
  }
}

/**
 * DASH-specific MPD parse error
 */
export class DASHMPDError extends RecoverablePlaybackError {
  readonly _tag = "DASHMPDError" as const;

  constructor(
    readonly mpdUrl: string,
    playback?: Playback.Any,
    cause?: unknown,
    retryCount = 0,
  ) {
    super(`Failed to parse DASH MPD: ${mpdUrl}`, playback, cause, retryCount);
  }
}

/**
 * DASH-specific segment load error
 */
export class DASHSegmentError extends RecoverablePlaybackError {
  readonly _tag = "DASHSegmentError" as const;

  constructor(
    readonly segmentUrl: string,
    readonly mediaType: "video" | "audio",
    playback?: Playback.Any,
    cause?: unknown,
    retryCount = 0,
  ) {
    super(`Failed to load DASH ${mediaType} segment: ${segmentUrl}`, playback, cause, retryCount);
  }
}

// ============================================================================
// Error Type Unions
// ============================================================================

export namespace PlaybackErrors {
  /**
   * All possible playback errors
   */
  export type Any =
    | InitializationError
    | LoadError
    | EngineNotSupportedError
    | NetworkError
    | DecodeError
    | DRMError
    | NotSupportedError
    | AbortError
    | CreationError
    | HLSManifestError
    | HLSFragmentError
    | DASHMPDError
    | DASHSegmentError;

  /**
   * Union of all recoverable errors
   */
  export type Recoverable = Extract<Any, { _errorGroup: "Recoverable" }>;

  /**
   * Union of all fatal errors
   */
  export type Fatal = Extract<Any, { _errorGroup: "Fatal" }>;
}

// ============================================================================
// Error Type Guards
// ============================================================================

export const isRecoverableError = (error: PlaybackErrors.Any): error is PlaybackErrors.Recoverable =>
  error._errorGroup === "Recoverable";

export const isFatalError = (error: PlaybackErrors.Any): error is PlaybackErrors.Fatal => error._errorGroup === "Fatal";

export const isHLSError = (error: PlaybackErrors.Any): error is HLSManifestError | HLSFragmentError =>
  error._tag === "HLSManifestError" || error._tag === "HLSFragmentError";

export const isDASHError = (error: PlaybackErrors.Any): error is DASHMPDError | DASHSegmentError =>
  error._tag === "DASHMPDError" || error._tag === "DASHSegmentError";
