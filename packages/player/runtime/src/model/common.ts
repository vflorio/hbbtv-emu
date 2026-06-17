/**
 * Media resolution information
 */
export interface Resolution {
  readonly width: number;
  readonly height: number;
}

/**
 * Time range for buffered content
 */
export interface TimeRange {
  readonly start: number;
  readonly end: number;
}
