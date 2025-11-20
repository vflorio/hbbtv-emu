import type { Channel } from "../channels";
import { logger } from "../utils";
import { PlayState } from "./playback";

export interface VideoChannelCallbacks {
  onPlayStateChange?: (state: PlayState) => void;
  onChannelLoadSuccess?: (channel: Channel) => void;
  onChannelLoadError?: (channel: Channel, error: number) => void;
  onRelease?: () => void;
  onStop?: () => void;
}

const log = logger("VideoChannel");

export class VideoChannel {
  private videoElement: HTMLVideoElement;
  private callbacks: VideoChannelCallbacks = {};
  private currentChannel: Channel | null = null;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    this.setupVideoEventListeners();
  }

  setCallbacks = (callbacks: VideoChannelCallbacks) => {
    this.callbacks = { ...this.callbacks, ...callbacks };
  };

  setupVideoEventListeners = () => {
    this.videoElement.addEventListener("loadstart", () => {
      log("loadstart");
      this.callbacks.onPlayStateChange?.(PlayState.CONNECTING);
    });

    this.videoElement.addEventListener("canplay", () => {
      log("canplay");
      if (!this.currentChannel) return;
      this.callbacks.onChannelLoadSuccess?.(this.currentChannel);
    });

    this.videoElement.addEventListener("playing", () => {
      log("playing");
      this.callbacks.onPlayStateChange?.(PlayState.PRESENTING);
    });

    this.videoElement.addEventListener("error", () => {
      log("error");
      if (!this.currentChannel) return;

      this.callbacks.onChannelLoadError?.(this.currentChannel, 100); // UNIDENTIFIED_ERROR
      this.callbacks.onPlayStateChange?.(PlayState.UNREALIZED);
    });

    this.videoElement.addEventListener("ended", () => {
      log("ended");
      this.callbacks.onPlayStateChange?.(PlayState.STOPPED);
    });
  };

  getChannelStreamUrl = (channel: Channel): string => {
    logger(`VideoBackend: Getting stream URL for channel: ${channel.name || channel.ccid}`);

    // TODO: integra la Triplet del pannello di controllo per determinare l'URL del flusso

    return "";
  };

  loadChannel = (channel: Channel): void => {
    this.currentChannel = channel;
    const streamUrl = this.getChannelStreamUrl(channel);

    logger(`VideoBackend: Loading channel stream: ${streamUrl}`);

    if (!streamUrl) {
      log("No stream URL available");
      this.callbacks.onChannelLoadError?.(channel, 5); // UNKNOWN_CHANNEL
      return;
    }

    this.videoElement.src = streamUrl;
    this.videoElement.load();
  };

  stop = () => {
    log("stop");
    this.videoElement.pause();
    this.currentChannel = null;

    this.callbacks.onPlayStateChange?.(PlayState.STOPPED);
    this.callbacks.onStop?.();
  };

  release = () => {
    log("release");
    this.videoElement.pause();
    this.videoElement.src = "";
    this.currentChannel = null;

    this.callbacks.onPlayStateChange?.(PlayState.UNREALIZED);
    this.callbacks.onRelease?.();
  };
}
