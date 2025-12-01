import type { ClassType } from "@hbb-emu/lib";
import type { VideoElement } from "./videoElement";

export interface EventDispatcher {
  dispatchEvent: (event: Event) => boolean;
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => void;
}

export interface EventTarget extends EventDispatcher {
  eventTarget: EventDispatcher;
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
    ): void => {
      this.eventTarget.addEventListener(type, listener, options);
    };

    removeEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void => {
      this.eventTarget.removeEventListener(type, listener, options);
    };
  };
