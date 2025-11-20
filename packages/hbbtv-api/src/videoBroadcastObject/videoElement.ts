import type { ClassType } from "../utils";
import { VideoChannel } from "./videoChannel";

export interface VideoElement {
  readonly videoElement: HTMLVideoElement;
  readonly videoChannel: VideoChannel;
}

export const WithVideoElement = <T extends ClassType>(Base: T) =>
  class extends Base implements VideoElement {
    readonly videoElement: HTMLVideoElement;
    readonly videoChannel: VideoChannel;

    constructor(...args: any[]) {
      super(...args);
      this.videoElement = document.createElement("video");
      this.videoChannel = new VideoChannel(this.videoElement);
    }
  };
