import type { ClassType } from "@hbb-emu/lib";
import type { VideoElement } from "./videoElement";

export namespace EventDispatcher {
  export interface Contract {
    dispatchEvent: DispatchEvent;
    addEventListener: AddEventListener;
    removeEventListener: RemoveEventListener;
  }

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
}

export namespace EventTarget {
  export interface Contract extends EventDispatcher.Contract {
    readonly eventTarget: EventDispatcher.Contract;
  }
}

export const WithEventTarget = <T extends ClassType<VideoElement.Contract>>(Base: T) =>
  class extends Base implements EventTarget.Contract {
    get eventTarget(): EventDispatcher.Contract {
      return this.videoElement;
    }

    dispatchEvent: EventDispatcher.DispatchEvent = (event) => this.eventTarget.dispatchEvent(event);

    addEventListener: EventDispatcher.AddEventListener = (type, listener, options) => {
      this.eventTarget.addEventListener(type, listener, options);
    };

    removeEventListener: EventDispatcher.RemoveEventListener = (type, listener, options) => {
      this.eventTarget.removeEventListener(type, listener, options);
    };
  };
