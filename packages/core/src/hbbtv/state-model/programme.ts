/**
 * Programme (EPG) State
 *
 * State for Electronic Programme Guide entries.
 */

import * as t from "io-ts";

// ─────────────────────────────────────────────────────────────────────────────
// Parental Rating State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parental rating state.
 */
export const ParentalRatingStateCodec = t.partial({
  /** Rating scheme (e.g., "dvb-si") */
  scheme: t.string,
  /** Rating value */
  value: t.number,
  /** Minimum age */
  minimumAge: t.number,
  /** Human-readable label */
  label: t.string,
  /** Region/country code */
  region: t.string,
});

export type ParentalRatingState = t.TypeOf<typeof ParentalRatingStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Programme State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Programme (EPG entry) state.
 */
export const ProgrammeStateCodec = t.intersection([
  t.type({
    /** Programme name/title */
    name: t.string,
    /** Start time (ISO 8601 string) */
    startTime: t.string,
    /** Duration in seconds */
    duration: t.number,
  }),
  t.partial({
    /** Unique programme ID */
    programmeID: t.string,
    /** Programme ID type (e.g., CRID) */
    programmeIDType: t.string,
    /** Short description */
    description: t.string,
    /** Long description */
    longDescription: t.string,
    /** Channel ccid */
    channelID: t.string,
    /** Episode number */
    episode: t.number,
    /** Total episodes */
    totalEpisodes: t.number,
    /** Season number */
    season: t.number,
    /** Genre categories */
    genre: t.array(t.string),
    /** Parental ratings */
    parentalRatings: t.array(ParentalRatingStateCodec),
  }),
]);

export type ProgrammeState = t.TypeOf<typeof ProgrammeStateCodec>;
