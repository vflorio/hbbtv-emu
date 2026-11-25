/**
 * A/V Control — the object's own player
 *
 * Each A/V Control object renders its media with a player runtime of its own (the
 * page can hold several). This adapts `VideoStreamService` to what the object's parts
 * need: `MediaPlayer` (playback) and `AudioOutput` (volume).
 */

import { createLogger } from "@hbb-emu/core";
import * as E from "fp-ts/Either";
import type * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";
import type { PlayerRuntimeFactory } from "../../../runtime";
import { isStateChangeEvent, type VideoStreamError, VideoStreamService } from "../../../subsystems/videoStream";
import type { AudioOutput } from "../../dae/videoBroadcast/volume";
import type { MediaPlayer } from "./playback";

const logger = createLogger("AVControl:Stream");

export type AvStream = MediaPlayer &
  AudioOutput &
  Readonly<{
    videoElement: HTMLVideoElement;
    destroy: IO.IO<void>;
  }>;

/** Runs a player command without waiting for it: a failure is logged, the player reports its state. */
const run =
  (what: string, task: TE.TaskEither<VideoStreamError, void>): IO.IO<void> =>
  () => {
    void task().then(
      E.match(
        (error) => logger.warn(what, "failed:", error.message)(),
        () => undefined,
      ),
    );
  };

/** Milliseconds, as OIPF counts them. */
const toMillis = (seconds: number): number => Math.floor(seconds * 1000);

export const createAvStream = (factory: PlayerRuntimeFactory): AvStream => {
  const stream = new VideoStreamService(undefined, factory);
  const video = stream.videoElement;

  return {
    videoElement: video,
    load: (url) => run("load", stream.loadSource({ url })),
    play: run("play", stream.play()),
    pause: run("pause", stream.pause()),
    stop: run("stop", stream.stop()),
    seek: (position) => run("seek", stream.seek(position)),
    getPosition: () => (video.readyState === HTMLMediaElement.HAVE_NOTHING ? undefined : toMillis(video.currentTime)),
    getDuration: () => (Number.isFinite(video.duration) && video.duration > 0 ? toMillis(video.duration) : undefined),
    onStreamStateChange: (listener) =>
      stream.subscribe((event) => {
        if (isStateChangeEvent(event)) listener(event.state);
      })(),
    setVolume: (volume) => run("setVolume", stream.setVolume(volume)),
    setMuted: (muted) => run("setMuted", stream.setMuted(muted)),
    destroy: stream.release(),
  };
};
