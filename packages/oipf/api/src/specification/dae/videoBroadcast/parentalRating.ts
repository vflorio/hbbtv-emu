/**
 * HbbTV Parental Rating API
 *
 * Defines interfaces for parental rating and content access control
 * in HbbTV applications.
 *
 * @see OIPF DAE Specification Section 7.9
 * @see HbbTV Specification
 */

// ============================================================================
// Parental Rating Interface
// ============================================================================

/**
 * Represents a parental rating for content.
 *
 * Parental ratings indicate the age-appropriateness or content warnings
 * for broadcast and on-demand content.
 */
export interface ParentalRating {
  /**
   * The name of the rating.
   *
   * Human-readable label for the rating (e.g., "PG-13", "12A", "FSK 16").
   */
  readonly name: string;

  /**
   * The rating scheme identifier.
   *
   * Identifies the parental rating system used (e.g., "dvb-si", "mpaa", "bbfc").
   * The format follows DVB specifications for rating scheme identification.
   */
  readonly scheme: string;

  /**
   * The numeric value of the rating.
   *
   * Typically represents the minimum recommended age in years.
   * A value of 0 typically means "suitable for all ages".
   */
  readonly value: number;

  /**
   * Labels providing additional content information.
   *
   * May include content descriptors like "violence", "language", etc.
   */
  readonly labels?: readonly string[];

  /**
   * The region/country for which this rating applies.
   *
   * ISO 3166-1 alpha-3 country code.
   */
  readonly region?: string;
}

// ============================================================================
// Parental Rating Collection Interface
// ============================================================================

/**
 * Collection of ParentalRating objects.
 *
 * Content may have multiple parental ratings from different rating
 * schemes or for different regions.
 */
export interface ParentalRatingCollection {
  /**
   * The number of ratings in the collection.
   */
  readonly length: number;

  /**
   * Returns the rating at the specified index.
   *
   * @param index - The zero-based index
   * @returns The ParentalRating at the index, or undefined if out of bounds
   */
  item(index: number): ParentalRating | undefined;

  /**
   * Returns the rating for the specified scheme.
   *
   * @param scheme - The rating scheme identifier
   * @returns The ParentalRating for the scheme, or undefined if not found
   */
  getRating(scheme: string): ParentalRating | undefined;

  /**
   * Array-like index access.
   */
  [index: number]: ParentalRating;
}

// ============================================================================
// Parental Control Manager Interface
// ============================================================================

/**
 * Provides access to parental control settings and operations.
 *
 * @note Access to some methods may require PIN verification.
 */
export interface ParentalControlManager {
  /**
   * The current parental rating threshold.
   *
   * Content with a rating value higher than this threshold will be blocked.
   */
  readonly threshold: ParentalRating | null;

  /**
   * Indicates whether parental control is enabled.
   */
  readonly enabled: boolean;

  /**
   * The rating schemes supported by this terminal.
   */
  readonly supportedSchemes: readonly string[];

  /**
   * Checks if the specified content is blocked by parental controls.
   *
   * @param ratings - The parental ratings to check
   * @returns `true` if the content would be blocked
   */
  isBlocked(ratings: ParentalRatingCollection): boolean;

  /**
   * Requests temporary authorization to view blocked content.
   *
   * This typically triggers a PIN entry dialog.
   *
   * @param ratings - The ratings of the content to authorize
   * @returns Promise resolving to `true` if authorization was granted
   */
  requestAuthorization?(ratings: ParentalRatingCollection): Promise<boolean>;

  /**
   * Handler called when the parental control threshold changes.
   */
  onThresholdChange?: () => void;
}
