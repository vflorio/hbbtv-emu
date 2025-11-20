import type { Constructor } from "../utils";
import { VideoChannel } from "./videoChannel";

export interface WithVideoElement {
  readonly videoElement: HTMLVideoElement;
  readonly videoChannel: VideoChannel;
}

export const WithVideoElement = <T extends Constructor>(Base: T) =>
  class extends Base implements WithVideoElement {
    readonly videoElement: HTMLVideoElement;
    readonly videoChannel: VideoChannel;

    constructor(...args: any[]) {
      super(...args);
      this.videoElement = document.createElement("video");
      this.videoChannel = new VideoChannel(this.videoElement);
    }
  };
