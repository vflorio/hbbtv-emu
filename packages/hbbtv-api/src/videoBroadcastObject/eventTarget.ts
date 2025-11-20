import type { ClassType } from "../utils";
import type { WithVideoElement } from "./videoElement";

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

export interface WithEventTarget extends EventDispatcher {
  readonly eventTarget: EventDispatcher;
}

export const WithEventTarget = <T extends ClassType<WithVideoElement>>(Base: T) =>
  class extends Base implements WithEventTarget {
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
