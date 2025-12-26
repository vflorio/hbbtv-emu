import type { PlaybackSnapshot, PlayerEngineEvent } from "@hbb-emu/player-runtime";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RA from "fp-ts/ReadonlyArray";

export type VideoEventListener = (event: PlayerEngineEvent) => void;

export const snapshotOf = (video: HTMLVideoElement): PlaybackSnapshot => ({
  currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
  duration: Number.isFinite(video.duration) ? video.duration : 0,
  buffered: getBufferedRanges(video),
  playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
  paused: video.paused,
});

export const emit = (listeners: Set<VideoEventListener>) => (event: PlayerEngineEvent) =>
  pipe(
    [...listeners],
    RA.traverse(IO.Applicative)((listener) => IO.of(listener(event))),
    IO.asUnit,
  );

export const getBufferedRanges = (video: HTMLVideoElement) => {
  const ranges: { start: number; end: number }[] = [];
  for (let i = 0; i < video.buffered.length; i++) {
    ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
  }
  return ranges;
};
