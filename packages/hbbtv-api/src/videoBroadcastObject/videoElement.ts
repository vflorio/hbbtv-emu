import { type Channel, type ClassType, createLogger, type MessageBus } from "@hbb-emu/lib";
import { hasTriplet, serializeTriplet } from "../channels";
import { PlayState } from "./playback";

export type VideoElementEventType = "PlayStateChange" | "ChannelLoadSuccess" | "ChannelLoadError";

export interface VideoElement {
  readonly videoElement: HTMLVideoElement;
  getChannelStreamUrl: (channel: Channel) => string;
  loadVideo: (channel: Channel) => void;
  stopVideo: () => void;
}

const logger = createLogger("VideoBroadcast/VideoElement");

export const WithVideoElement = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base implements VideoElement {
    readonly videoElement: HTMLVideoElement;

    channelStreamUrls: Map<string, string> = new Map();
    currentVideoChannel: Channel | null = null;
    isVideoReleasing: boolean = false;

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CHANNELS", ({ message: { payload } }) => {
        payload.forEach((channel) => {
          this.channelStreamUrls.set(serializeTriplet(channel), channel.mp4Source);
        });
      });

      const loadstart = () => {
        logger.log("loadstart");
        this.dispatchVideoEvent("PlayStateChange", PlayState.CONNECTING);
      };

      const canplay = () => {
        logger.log("canplay");
        this.dispatchVideoEvent("ChannelLoadSuccess", this.currentVideoChannel);
        this.dispatchVideoEvent("PlayStateChange", PlayState.PRESENTING);
      };

      const pause = () => {
        logger.log("pause");
        if (this.isVideoReleasing) {
          this.isVideoReleasing = false;
          this.dispatchVideoEvent("PlayStateChange", PlayState.UNREALIZED);
        } else {
          this.dispatchVideoEvent("PlayStateChange", PlayState.STOPPED);
        }
      };

      const error = () => {
        logger.log("error");
        this.dispatchVideoEvent("ChannelLoadError", this.currentVideoChannel);
        this.dispatchVideoEvent("PlayStateChange", PlayState.UNREALIZED);
      };

      this.videoElement = document.createElement("video");

      this.videoElement.addEventListener("loadstart", loadstart);
      this.videoElement.addEventListener("canplay", canplay);
      this.videoElement.addEventListener("pause", pause);
      this.videoElement.addEventListener("error", error);

      this.videoElement.loop = true;
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
    }

    dispatchVideoEvent = <T>(eventType: VideoElementEventType, payload: T) =>
      this.videoElement.dispatchEvent(new CustomEvent(eventType, { detail: payload }));

    getChannelStreamUrl = (channel: Channel): string => {
      const key = hasTriplet(channel) ? serializeTriplet(channel) : channel?.ccid || "";
      logger.log(`Getting stream URL for channel: ${key}`);
      return this.channelStreamUrls.get(key) || "";
    };

    loadVideo = (channel: Channel) => {
      const streamUrl = this.getChannelStreamUrl(channel);

      logger.log(`Loading channel stream: ${streamUrl}`);

      if (!streamUrl) {
        logger.log("No stream URL available");
        return;
      }

      this.videoElement.src = streamUrl;
      this.videoElement.load();
    };

    stopVideo = () => {
      logger.log("stop");
      this.videoElement.pause();
      this.videoElement.src = "";
    };

    releaseVideo = () => {
      logger.log("release");
      this.isVideoReleasing = true;
      this.stopVideo();
    };
  };
