/**
 * VideoStream Domain Errors - Tagged Union (ADT)
 */

export type VideoStreamError =
  | {
      readonly _tag: "VideoStreamError/NotInitialized";
      readonly message: string;
    }
  | {
      readonly _tag: "VideoStreamError/Network";
      readonly message: string;
      readonly code: number;
      readonly details?: unknown;
    }
  | {
      readonly _tag: "VideoStreamError/NotSupported";
      readonly message: string;
      readonly code: number;
      readonly details?: unknown;
    }
  | {
      readonly _tag: "VideoStreamError/DRM";
      readonly message: string;
      readonly code: number;
      readonly details?: unknown;
    }
  | {
      readonly _tag: "VideoStreamError/Unknown";
      readonly message: string;
      readonly code: number;
      readonly details?: unknown;
    };

/**
 * Error constructors
 */
export const VideoStreamError = {
  notInitialized: (message: string): VideoStreamError => ({
    _tag: "VideoStreamError/NotInitialized",
    message,
  }),
  network: (message: string, code = 2, details?: unknown): VideoStreamError => ({
    _tag: "VideoStreamError/Network",
    message,
    code,
    details,
  }),
  notSupported: (message: string, code = 4, details?: unknown): VideoStreamError => ({
    _tag: "VideoStreamError/NotSupported",
    message,
    code,
    details,
  }),
  drm: (message: string, code = 6, details?: unknown): VideoStreamError => ({
    _tag: "VideoStreamError/DRM",
    message,
    code,
    details,
  }),
  unknown: (message: string, code = 1, details?: unknown): VideoStreamError => ({
    _tag: "VideoStreamError/Unknown",
    message,
    code,
    details,
  }),
} as const;

/**
 * Type guards for VideoStreamError
 */
export const isNotInitialized = (
  error: VideoStreamError,
): error is VideoStreamError & { _tag: "VideoStreamError/NotInitialized" } =>
  error._tag === "VideoStreamError/NotInitialized";

export const isNetworkError = (
  error: VideoStreamError,
): error is VideoStreamError & { _tag: "VideoStreamError/Network"; message: string; code: number; details?: unknown } =>
  error._tag === "VideoStreamError/Network";

export const isNotSupportedError = (
  error: VideoStreamError,
): error is VideoStreamError & {
  _tag: "VideoStreamError/NotSupported";
  message: string;
  code: number;
  details?: unknown;
} => error._tag === "VideoStreamError/NotSupported";

export const isDRMError = (
  error: VideoStreamError,
): error is VideoStreamError & { _tag: "VideoStreamError/DRM"; message: string; code: number; details?: unknown } =>
  error._tag === "VideoStreamError/DRM";

export const isUnknownError = (
  error: VideoStreamError,
): error is VideoStreamError & { _tag: "VideoStreamError/Unknown"; message: string; code: number; details?: unknown } =>
  error._tag === "VideoStreamError/Unknown";
