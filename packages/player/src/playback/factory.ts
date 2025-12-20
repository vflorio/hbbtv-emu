/**
 * Playback Factory
 *
 * Factory pattern with automatic source type detection for creating
 * appropriate playback instances.
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { DASHPlayback } from "./dash";
import { CreationError, type PlaybackErrors } from "./errors";
import { HLSPlayback } from "./hls";
import { NativePlayback } from "./native";
import type { DASHConfig, HLSConfig, NativeConfig, PlaybackConfig, PlaybackType } from "./types";

// ============================================================================
// Playback Namespace
// ============================================================================

export namespace Playback {
  // Export playback classes
  export const Native = NativePlayback;
  export const HLS = HLSPlayback;
  export const DASH = DASHPlayback;

  /**
   * Union type of all playback implementations
   */
  export type Any = NativePlayback | HLSPlayback | DASHPlayback;

  // =========================================================================
  // Source Type Detection
  // =========================================================================

  /**
   * Detect playback type from source URL
   *
   * @param source - Media source URL
   * @returns Detected playback type
   */
  export const detectType = (source: string): PlaybackType =>
    match(source)
      .when(
        (s) => s.endsWith(".m3u8") || s.includes(".m3u8?"),
        () => "hls" as const,
      )
      .when(
        (s) => s.endsWith(".mpd") || s.includes(".mpd?"),
        () => "dash" as const,
      )
      .when(
        (s) => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(s),
        () => "native" as const,
      )
      .otherwise(() => "native" as const); // Fallback to native

  /**
   * Check if HLS is natively supported by the browser
   */
  export const isHLSNativelySupported = (videoElement: HTMLVideoElement): boolean => {
    const canPlayHLS = videoElement.canPlayType("application/vnd.apple.mpegurl");
    return canPlayHLS === "probably" || canPlayHLS === "maybe";
  };

  // =========================================================================
  // Default Configurations
  // =========================================================================

  /**
   * Default configuration for all playback types
   */
  export const defaultConfig: PlaybackConfig = {
    native: {
      preload: "metadata",
      autoplay: false,
    },
    hls: {
      autoStartLoad: true,
      startLevel: -1, // Auto
      debug: false,
    },
    dash: {
      debug: false,
      streaming: {
        bufferTimeDefault: 12,
        bufferTimeMax: 20,
      },
    },
  };

  // =========================================================================
  // Factory Functions
  // =========================================================================

  /**
   * Create appropriate playback instance based on source URL
   *
   * @param source - Media source URL
   * @param config - Configuration for all playback types (optional, uses defaults)
   * @param forceType - Optional: Force specific playback type
   * @returns TaskEither with playback instance or error
   */
  export const create = (
    source: string,
    config?: Partial<PlaybackConfig>,
    forceType?: PlaybackType,
  ): TE.TaskEither<PlaybackErrors.Any, Playback.Any> => {
    // Merge with defaults
    const fullConfig: PlaybackConfig = {
      native: { ...defaultConfig.native, ...config?.native },
      hls: { ...defaultConfig.hls, ...config?.hls },
      dash: { ...defaultConfig.dash, ...config?.dash },
    };

    const type = forceType ?? detectType(source);

    return pipe(
      TE.tryCatch(
        async () =>
          match(type)
            .with("native", () => new Playback.Native({ source, config: fullConfig.native }))
            .with("hls", () => new Playback.HLS({ source, config: fullConfig.hls }))
            .with("dash", () => new Playback.DASH({ source, config: fullConfig.dash }))
            .exhaustive(),
        (error) => new CreationError(type, error instanceof Error ? error.message : String(error), error),
      ),
    );
  };

  /**
   * Create native playback instance
   */
  export const createNative = (source: string, config: NativeConfig): E.Either<PlaybackErrors.Any, NativePlayback> =>
    E.tryCatch(
      () => new Playback.Native({ source, config }),
      (error) => new CreationError("native", error instanceof Error ? error.message : String(error), error),
    );

  /**
   * Create HLS playback instance
   */
  export const createHLS = (source: string, config: HLSConfig): E.Either<PlaybackErrors.Any, HLSPlayback> =>
    E.tryCatch(
      () => new Playback.HLS({ source, config }),
      (error) => new CreationError("hls", error instanceof Error ? error.message : String(error), error),
    );

  /**
   * Create DASH playback instance
   */
  export const createDASH = (source: string, config: DASHConfig): E.Either<PlaybackErrors.Any, DASHPlayback> =>
    E.tryCatch(
      () => new Playback.DASH({ source, config }),
      (error) => new CreationError("dash", error instanceof Error ? error.message : String(error), error),
    );

  /**
   * Create playback with default configuration
   */
  export const createWithDefaults = (
    source: string,
    overrides?: Partial<PlaybackConfig>,
  ): TE.TaskEither<PlaybackErrors.Any, Playback.Any> => {
    const config: PlaybackConfig = {
      native: { ...defaultConfig.native, ...overrides?.native },
      hls: { ...defaultConfig.hls, ...overrides?.hls },
      dash: { ...defaultConfig.dash, ...overrides?.dash },
    };

    return create(source, config);
  };
}
