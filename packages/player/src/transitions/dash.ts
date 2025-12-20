/**
 * DASH-Specific Transitions
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { type DASHRepresentation, PlayerState } from "../state";

// ============================================================================
// DASH Transition Context Types
// ============================================================================

export interface RepresentationSelectionParams {
  readonly representation: DASHRepresentation;
  readonly reason: "abr" | "manual" | "constraint";
}

// ============================================================================
// DASH-Specific Transitions
// ============================================================================

/**
 * Parse DASH MPD
 */
export const parseDASHMPD = (
  mpdLoading: PlayerState.Source.DASH.MPDLoading,
): TE.TaskEither<PlayerState.Source.DASH.MPDParseError, PlayerState.Source.DASH.MPDParsed> =>
  pipe(
    TE.tryCatch(
      async () => {
        // Simulate MPD parsing
        const adaptationSets = [
          {
            id: "video",
            contentType: "video" as const,
            mimeType: "video/mp4",
            representations: [
              {
                id: "video-1080p",
                bandwidth: 5000000,
                codecs: "avc1.42E01E",
                resolution: { width: 1920, height: 1080 },
              },
              {
                id: "video-720p",
                bandwidth: 2500000,
                codecs: "avc1.42E01E",
                resolution: { width: 1280, height: 720 },
              },
            ],
          },
        ];

        return new PlayerState.Source.DASH.MPDParsed(
          mpdLoading.url,
          adaptationSets,
          120, // duration
          false, // isDynamic
        );
      },
      (error) =>
        new PlayerState.Source.DASH.MPDParseError(
          error instanceof Error ? error : new Error(String(error)),
          0,
          mpdLoading.url,
        ),
    ),
  );

/**
 * Select DASH representation
 */
export const selectDASHRepresentation = (
  mpdParsed: PlayerState.Source.DASH.MPDParsed,
  params: RepresentationSelectionParams,
): E.Either<Error, PlayerState.Source.DASH.RepresentationSelected> =>
  // Validate representation exists
  mpdParsed.adaptationSets.some((set) => set.representations.some((r) => r.id === params.representation.id))
    ? E.right(
        new PlayerState.Source.DASH.RepresentationSelected(
          params.representation,
          params.representation.bandwidth,
          params.representation.resolution || { width: 0, height: 0 },
        ),
      )
    : E.left(new Error("Representation not found in MPD"));

/**
 * Switch DASH representation (quality switching)
 */
export const switchDASHRepresentation = (
  currentRepresentation: PlayerState.Source.DASH.RepresentationSelected,
  newRepresentation: DASHRepresentation,
  reason: "abr" | "manual" | "constraint",
): E.Either<never, PlayerState.Source.DASH.QualitySwitching> =>
  E.right(
    new PlayerState.Source.DASH.QualitySwitching(currentRepresentation.representation, newRepresentation, reason),
  );
