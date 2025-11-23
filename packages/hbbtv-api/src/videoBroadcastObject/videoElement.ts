import { logger, type ClassType } from "@hbb-emu/lib";
import { hasTriplet, serializeTriplet, type Channel } from "../channels";
import { PlayState } from "./playback";

export type VideoElementEventType = "PlayStateChange" | "ChannelLoadSuccess" | "ChannelLoadError";

export interface VideoElement {
  readonly videoElement: HTMLVideoElement;
  getChannelStreamUrl: (channel: Channel) => string;
  loadVideo: (channel: Channel) => void;
  stopVideo: () => void;
}

const log = logger("VideoElement");

export const WithVideoElement = <T extends ClassType>(Base: T) =>
  class extends Base implements VideoElement {
    readonly videoElement: HTMLVideoElement;

    channelStreamUrlCache: Map<string, string> = new Map();
    currentVideoChannel: Channel | null = null;
    isVideoReleasing: boolean = false;

    constructor(...args: any[]) {
      super(...args);

      const loadstart = () => {
        log("loadstart");
        this.dispatchVideoEvent("PlayStateChange", PlayState.CONNECTING);
      };

      const canplay = () => {
        log("canplay");
        this.dispatchVideoEvent("ChannelLoadSuccess", this.currentVideoChannel);
        this.dispatchVideoEvent("PlayStateChange", PlayState.PRESENTING);
      };

      const pause = () => {
        log("pause");
        if (this.isVideoReleasing) {
          this.isVideoReleasing = false;
          this.dispatchVideoEvent("PlayStateChange", PlayState.UNREALIZED);
        } else {
          this.dispatchVideoEvent("PlayStateChange", PlayState.STOPPED);
        }
      };

      const error = () => {
        log("error");
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
      log(`Getting stream URL for channel: ${key}`);
      return this.channelStreamUrlCache.get(key) || "";
    };

    loadVideo = (channel: Channel) => {
      const streamUrl = this.getChannelStreamUrl(channel);

      log(`Loading channel stream: ${streamUrl}`);

      if (!streamUrl) {
        log("No stream URL available");
        return;
      }

      this.videoElement.src = streamUrl;
      this.videoElement.load();
    };

    stopVideo = () => {
      log("stop");
      this.videoElement.pause();
      this.videoElement.src = "";
    };

    releaseVideo = () => {
      log("release");
      this.isVideoReleasing = true;
      this.stopVideo();
    };
  };
