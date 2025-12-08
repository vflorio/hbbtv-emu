/**
 * HbbTV Programme API
 *
 * Defines the Programme interface for Electronic Programme Guide (EPG)
 * data in HbbTV applications.
 *
 * @see OIPF DAE Specification Section 7.10
 * @see HbbTV Specification
 */

import type { ParentalRatingCollection } from "./parentalRating";

// ============================================================================
// Programme Interface
// ============================================================================

/**
 * Represents a broadcast programme (show/event) in the EPG.
 *
 * Programme objects provide metadata about broadcast content including
 * timing, titles, descriptions, and parental ratings.
 *
 * Obtained via:
 * - `VideoBroadcast.programmes` collection
 * - EPG/metadata query APIs
 *
 * @example
 * ```typescript
 * const programmes = videoBroadcast.programmes;
 * if (programmes.length > 0) {
 *   const current = programmes.item(0);
 *   console.log(`Now: ${current?.name}`);
 *   console.log(`Duration: ${current?.duration} seconds`);
 * }
 * ```
 */
export interface Programme {
  /**
   * The name/title of the programme.
   */
  readonly name: string;

  /**
   * Unique identifier for the programme.
   *
   * The format is implementation-specific.
   */
  readonly programmeID?: string;

  /**
   * The Content Reference Identifier (CRID) for the programme.
   *
   * Used for series linking and recording identification.
   */
  readonly programmeIDType?: string;

  /**
   * A short description of the programme.
   */
  readonly description?: string;

  /**
   * A longer, more detailed description of the programme.
   */
  readonly longDescription?: string;

  /**
   * The start time of the programme as a Date object.
   */
  readonly startTime: Date;

  /**
   * The duration of the programme in seconds.
   */
  readonly duration: number;

  /**
   * The channel on which this programme is broadcast.
   *
   * Contains the ccid of the channel.
   */
  readonly channelID?: string;

  /**
   * The episode number within the series.
   */
  readonly episode?: number;

  /**
   * The total number of episodes in the series.
   */
  readonly totalEpisodes?: number;

  /**
   * The season/series number.
   */
  readonly season?: number;

  /**
   * The parental ratings for this programme.
   */
  readonly parentalRatings?: ParentalRatingCollection;

  /**
   * The genre(s) of the programme.
   *
   * May be a single string or comma-separated list.
   */
  readonly genre?: string;

  /**
   * Indicates whether the programme is currently being broadcast.
   */
  readonly showType?: number;

  /**
   * Indicates whether the programme is available for recording.
   */
  readonly recordable?: boolean;

  /**
   * URI for the programme's thumbnail/poster image.
   */
  readonly thumbnailUri?: string;

  /**
   * Returns SI descriptors from the EIT for this programme.
   *
   * @param descriptorTag - The descriptor tag to retrieve
   * @param descriptorTagExtension - Extended descriptor tag (optional)
   * @param privateDataSpecifier - Private data specifier (optional)
   *
   * @returns Array of descriptor data as strings, or empty array if not available
   */
  getSIDescriptors?(
    descriptorTag: number,
    descriptorTagExtension?: number,
    privateDataSpecifier?: number,
  ): readonly string[];
}

// ============================================================================
// Programme Collection Interface
// ============================================================================

/**
 * Collection of Programme objects.
 *
 * Provides array-like access to programmes. The collection is typically
 * ordered by start time, with index 0 being the current or earliest programme.
 */
export interface ProgrammeCollection {
  /**
   * The number of programmes in the collection.
   *
   * Indicates the number of items currently known and up to date
   * (i.e., not yet ended based on startTime + duration).
   */
  readonly length: number;

  /**
   * Returns the programme at the specified index.
   *
   * @param index - The zero-based index
   * @returns The Programme at the index, or undefined if out of bounds
   */
  item(index: number): Programme | undefined;

  /**
   * Array-like index access.
   */
  [index: number]: Programme;
}

// ============================================================================
// Search Parameters
// ============================================================================

/**
 * Parameters for searching programmes in the EPG.
 */
export interface ProgrammeSearchParams {
  /**
   * Search by programme name (supports wildcards).
   */
  name?: string;

  /**
   * Search by channel ccid.
   */
  channelID?: string;

  /**
   * Search for programmes starting after this time.
   */
  startTime?: Date;

  /**
   * Search for programmes ending before this time.
   */
  endTime?: Date;

  /**
   * Search by genre.
   */
  genre?: string;

  /**
   * Maximum number of results to return.
   */
  count?: number;

  /**
   * Offset for pagination.
   */
  offset?: number;
}
