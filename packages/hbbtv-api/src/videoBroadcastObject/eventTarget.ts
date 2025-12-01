import type { ClassType } from "@hbb-emu/lib";
import type { VideoElement } from "./videoElement";

export type DispatchEvent = (event: Event) => boolean;
export type AddEventListener = (
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
) => void;
export type RemoveEventListener = (
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | EventListenerOptions,
) => void;

export interface EventDispatcher {
  dispatchEvent: DispatchEvent;
  addEventListener: AddEventListener;
  removeEventListener: RemoveEventListener;
}

export interface EventTarget extends EventDispatcher {
  readonly eventTarget: EventDispatcher;
}

export const WithEventTarget = <T extends ClassType<VideoElement>>(Base: T) =>
  class extends Base implements EventTarget {
    get eventTarget(): EventDispatcher {
      return this.videoElement;
    }

    dispatchEvent: DispatchEvent = (event) => this.eventTarget.dispatchEvent(event);

    addEventListener: AddEventListener = (type, listener, options) => {
      this.eventTarget.addEventListener(type, listener, options);
    };

    removeEventListener: RemoveEventListener = (type, listener, options) => {
      this.eventTarget.removeEventListener(type, listener, options);
    };
  };
