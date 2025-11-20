import type { Constructor } from "../utils";
import { VideoChannel } from "./videoChannel";

export interface WithVideoElement {
  readonly videoElement: HTMLVideoElement;
  readonly videoChannel: VideoChannel;

  dispatchEvent(event: Event): boolean;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
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

    dispatchEvent(event: Event): boolean {
      return this.videoElement.dispatchEvent(event);
    }

    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      this.videoElement.addEventListener(type, listener, options);
    }

    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void {
      this.videoElement.removeEventListener(type, listener, options);
    }
  };
