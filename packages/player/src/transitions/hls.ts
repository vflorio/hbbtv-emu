/**
 * HLS-Specific Transitions
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { type HLSVariant, PlayerState } from "../state";

// ============================================================================
// HLS Transition Context Types
// ============================================================================

export interface VariantSelectionParams {
  readonly variant: HLSVariant;
  readonly reason: "bandwidth" | "manual";
}

// ============================================================================
// HLS-Specific Transitions
// ============================================================================

/**
 * Parse HLS manifest
 */
export const parseHLSManifest = (
  manifestLoading: PlayerState.Source.HLS.ManifestLoading,
): TE.TaskEither<PlayerState.Source.HLS.ManifestParseError, PlayerState.Source.HLS.ManifestParsed> =>
  pipe(
    TE.tryCatch(
      async () => {
        // Simulate manifest parsing
        const variants: HLSVariant[] = [
          {
            bandwidth: 5000000,
            resolution: { width: 1920, height: 1080 },
            codecs: "avc1.42E01E, mp4a.40.2",
            url: `${manifestLoading.url}/variant-1080p.m3u8`,
          },
          {
            bandwidth: 2500000,
            resolution: { width: 1280, height: 720 },
            codecs: "avc1.42E01E, mp4a.40.2",
            url: `${manifestLoading.url}/variant-720p.m3u8`,
          },
        ];

        return new PlayerState.Source.HLS.ManifestParsed(
          manifestLoading.url,
          variants,
          120, // duration
        );
      },
      (error) =>
        new PlayerState.Source.HLS.ManifestParseError(
          error instanceof Error ? error : new Error(String(error)),
          0,
          manifestLoading.url,
        ),
    ),
  );

/**
 * Select HLS variant
 */
export const selectHLSVariant = (
  manifestParsed: PlayerState.Source.HLS.ManifestParsed,
  params: VariantSelectionParams,
): E.Either<Error, PlayerState.Source.HLS.VariantSelected> =>
  // Validate variant exists
  manifestParsed.variants.some((v) => v.url === params.variant.url)
    ? E.right(
        new PlayerState.Source.HLS.VariantSelected(params.variant, params.variant.bandwidth, params.variant.resolution),
      )
    : E.left(new Error("Variant not found in manifest"));

/**
 * Switch HLS variant (adaptive streaming)
 */
export const switchHLSVariant = (
  currentVariant: PlayerState.Source.HLS.VariantSelected,
  newVariant: HLSVariant,
  reason: "bandwidth" | "manual",
): E.Either<never, PlayerState.Source.HLS.AdaptiveSwitching> =>
  E.right(new PlayerState.Source.HLS.AdaptiveSwitching(currentVariant.variant, newVariant, reason));
