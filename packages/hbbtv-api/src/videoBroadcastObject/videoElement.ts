import { type Channel, type ClassType, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type { ChannelStreamAdapter } from "./channelStreamAdapter";
import { PlayState } from "./playback";

export type VideoElementEventType = "PlayStateChange" | "ChannelLoadSuccess" | "ChannelLoadError";

export interface VideoElement {
  readonly videoElement: HTMLVideoElement;
  loadVideo: (channel: Channel) => void;
  stopVideo: () => void;
  releaseVideo: () => void;
}

const logger = createLogger("VideoBroadcast/VideoElement");

export const WithVideoElement = <T extends ClassType<ChannelStreamAdapter>>(Base: T) =>
  class extends Base implements VideoElement {
    readonly videoElement: HTMLVideoElement;
    currentVideoChannelRef = IORef.newIORef<O.Option<Channel>>(O.none)();

    constructor(...args: any[]) {
      super(...args);

      const loadstart = () =>
        pipe(
          logger.info("loadstart"),
          IO.flatMap(() => () => this.dispatchVideoEvent("PlayStateChange", PlayState.CONNECTING)),
        )();

      const canplay = () =>
        pipe(
          logger.info("canplay"),
          IO.flatMap(() => () => {
            pipe(
              this.currentVideoChannelRef.read(),
              O.map((channel) => this.dispatchVideoEvent("ChannelLoadSuccess", channel)),
            );
            this.dispatchVideoEvent("PlayStateChange", PlayState.PRESENTING);
          }),
        )();

      const error = (event: Event) =>
        pipe(
          logger.info("error", event),
          IO.flatMap(() => () => {
            pipe(
              this.currentVideoChannelRef.read(),
              O.map((channel) => this.dispatchVideoEvent("ChannelLoadError", channel)),
            );
            this.dispatchVideoEvent("PlayStateChange", PlayState.UNREALIZED);
          }),
        )();

      this.videoElement = document.createElement("video");

      this.videoElement.addEventListener("loadstart", loadstart);
      this.videoElement.addEventListener("canplay", canplay);
      this.videoElement.addEventListener("error", error);

      this.videoElement.loop = true;
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
    }

    dispatchVideoEvent = <T>(eventType: VideoElementEventType, payload: T) =>
      this.videoElement.dispatchEvent(new CustomEvent(eventType, { detail: payload }));

    loadVideo = (channel: Channel) =>
      pipe(
        logger.info("loadVideo", channel),
        IO.flatMap(() => () => {
          const streamUrl = this.getChannelStreamUrl(channel);
          if (!streamUrl) {
            logger.warn("loadVideo: no stream URL found for channel, skipping load", channel)();
            return;
          }

          this.videoElement.src = streamUrl;
          this.videoElement.load();
          this.currentVideoChannelRef.write(O.some(channel));
        }),
      )();

    stopVideo = () =>
      pipe(
        logger.info("stop"),
        IO.flatMap(() => () => {
          this.dispatchVideoEvent("PlayStateChange", PlayState.STOPPED);
          this.cleanupVideoElement();
        }),
      )();

    releaseVideo = () =>
      pipe(
        logger.info("release"),
        IO.flatMap(() => () => {
          this.dispatchVideoEvent("PlayStateChange", PlayState.UNREALIZED);
          this.cleanupVideoElement();
        }),
      )();

    cleanupVideoElement = () => {
      this.videoElement.src = "";
      this.currentVideoChannelRef.write(O.none);
    };
  };
