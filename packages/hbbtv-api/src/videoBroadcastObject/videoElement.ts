import { type Channel, type ClassType, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import { addEventListener } from "fp-ts-std/DOM";
import type { ChannelStreamAdapter } from "./channelStreamAdapter";
import { PlayState } from "./playback";

export type VideoElementEventType = "PlayStateChange" | "ChannelLoadSuccess" | "ChannelLoadError";

export interface VideoElement {
  readonly videoElement: HTMLVideoElement;
  loadVideo: (channel: Channel) => IO.IO<void>;
  stopVideo: IO.IO<void>;
  releaseVideo: IO.IO<void>;
  dispatchVideoEvent: <T>(eventType: VideoElementEventType, payload: T) => IO.IO<boolean>;
}

const logger = createLogger("VideoBroadcast/VideoElement");

const createVideoElement: IO.IO<HTMLVideoElement> = () => {
  const video = document.createElement("video");
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  return video;
};

export const WithVideoElement = <T extends ClassType<ChannelStreamAdapter>>(Base: T) =>
  class extends Base implements VideoElement {
    readonly videoElement: HTMLVideoElement;
    currentVideoChannelRef = IORef.newIORef<O.Option<Channel>>(O.none)();

    constructor(...args: any[]) {
      super(...args);

      this.videoElement = createVideoElement();

      const onLoadStart = () =>
        pipe(
          logger.info("loadstart"),
          IO.tap(() => this.dispatchVideoEvent("PlayStateChange", PlayState.CONNECTING)),
        );

      const onCanPlay = () =>
        pipe(
          logger.info("canplay"),
          IO.tap(() =>
            pipe(
              this.currentVideoChannelRef.read,
              IO.tap(
                O.match(
                  () => IO.of(undefined),
                  (channel) => pipe(this.dispatchVideoEvent("ChannelLoadSuccess", channel), IO.asUnit),
                ),
              ),
            ),
          ),
          IO.tap(() => this.dispatchVideoEvent("PlayStateChange", PlayState.PRESENTING)),
        );

      const onError = (event: Event) =>
        pipe(
          logger.info("error", event),
          IO.tap(() =>
            pipe(
              this.currentVideoChannelRef.read,
              IO.tap(
                O.match(
                  () => IO.of(undefined),
                  (channel) => pipe(this.dispatchVideoEvent("ChannelLoadError", channel), IO.asUnit),
                ),
              ),
            ),
          ),
          IO.tap(() => this.dispatchVideoEvent("PlayStateChange", PlayState.UNREALIZED)),
        );

      pipe(
        IO.Do,
        IO.tap(() => addEventListener("loadstart")(onLoadStart)(this.videoElement)),
        IO.tap(() => addEventListener("canplay")(onCanPlay)(this.videoElement)),
        IO.tap(() => addEventListener("error")(onError)(this.videoElement)),
      )();
    }

    dispatchVideoEvent: <T>(eventType: VideoElementEventType, payload: T) => IO.IO<boolean> =
      (eventType, payload) => () =>
        this.videoElement.dispatchEvent(new CustomEvent(eventType, { detail: payload }));

    loadVideo: (channel: Channel) => IO.IO<void> = (channel) =>
      pipe(
        logger.info("loadVideo", channel),
        IO.tap(() =>
          pipe(
            this.getChannelStreamUrl(channel),
            O.match(
              () => pipe(logger.warn("loadVideo: no stream URL found for channel, skipping load", channel)),
              (streamUrl) =>
                pipe(
                  IO.Do,
                  IO.tap(() => () => {
                    this.videoElement.src = streamUrl;
                    this.videoElement.load();
                  }),
                  IO.tap(() => this.currentVideoChannelRef.write(O.some(channel))),
                ),
            ),
          ),
        ),
      );

    stopVideo: IO.IO<void> = pipe(
      logger.info("stop"),
      IO.tap(() => this.dispatchVideoEvent("PlayStateChange", PlayState.STOPPED)),
      IO.tap(() => this.cleanupVideoElement),
    );

    releaseVideo: IO.IO<void> = pipe(
      logger.info("release"),
      IO.tap(() => this.dispatchVideoEvent("PlayStateChange", PlayState.UNREALIZED)),
      IO.tap(() => this.cleanupVideoElement),
    );

    cleanupVideoElement: IO.IO<void> = pipe(
      IO.Do,
      IO.tap(() => () => {
        this.videoElement.src = "";
      }),
      IO.tap(() => this.currentVideoChannelRef.write(O.none)),
    );
  };
