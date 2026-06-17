import type { PlaybackType } from "./playback";

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

/**
 * Source metadata for playback
 */
export interface SourceMetadata {
  readonly playbackType: PlaybackType;
  readonly url: string;
  readonly resolution?: Resolution;
  readonly codec?: string;
}
