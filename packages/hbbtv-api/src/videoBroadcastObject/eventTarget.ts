import type { ClassType } from "@hbb-emu/lib";
import type { VideoElement } from "./videoElement";

export interface EventDispatcher {
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

export interface EventTarget extends EventDispatcher {
  readonly eventTarget: EventDispatcher;
}

export const WithEventTarget = <T extends ClassType<VideoElement>>(Base: T) =>
  class extends Base implements EventTarget {
    get eventTarget(): EventDispatcher {
      return this.videoElement;
    }

    dispatchEvent = (event: Event): boolean => this.eventTarget.dispatchEvent(event);

    addEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      this.eventTarget.addEventListener(type, listener, options);
    };

    removeEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      this.eventTarget.removeEventListener(type, listener, options);
    };
  };
