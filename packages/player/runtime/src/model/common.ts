import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import type { PlaybackType } from "./playback";

/**
 * Media resolution information
 */
export interface Resolution {
  readonly width: number;
  readonly height: number;
}

export const formatResolution = ({ width, height }: Resolution) => `${width}x${height}`;

/**
 * Time range for buffered content
 */
export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

export const toTimeRanges = (video: HTMLVideoElement): TimeRange[] =>
  pipe(
    A.makeBy(video.buffered.length, (index) => index), // [0, 1, 2, ..., buffered.length - 1]
    A.map((index) => ({
      start: video.buffered.start(index),
      end: video.buffered.end(index),
    })),
  );

/**
 * Source metadata for playback
 */
export interface SourceMetadata {
  readonly playbackType: PlaybackType;
  readonly url: string;
  readonly resolution?: Resolution;
  readonly codec?: string;
}
