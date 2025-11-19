import type { Constructor } from "../utils";
import type { WithPlayback } from "./playback";
import { PlayState } from "./playback";

export interface StreamEventDetail {
  readonly name: string;
  readonly data: string;
  readonly text: string;
  readonly status: string;
}

export interface StreamEvent extends CustomEvent<StreamEventDetail> {}

export interface StreamEventListener {
  targetURL: string;
  eventName: string;
  listener: EventListener;
}

interface WithStreamEvents {
  addStreamEventListener(targetURL: string, eventName: string, listener: EventListener): void;
  removeStreamEventListener(targetURL: string, eventName: string, listener: EventListener): void;
}

export const WithStreamEvents = <T extends Constructor<WithPlayback>>(Base: T) =>
  class extends Base implements WithStreamEvents {
    streamEventListeners: StreamEventListener[] = [];

    createStreamEvent = (detail: StreamEventDetail): StreamEvent =>
      new CustomEvent<StreamEventDetail>("StreamEvent", {
        detail,
      });

    addStreamEventListener = (targetURL: string, eventName: string, listener: EventListener) => {
      console.log(`addStreamEventListener(${targetURL}, ${eventName})`);

      // Listeners can only be added in Presenting or Stopped states
      if (!this.isPlayStateValid([PlayState.PRESENTING, PlayState.STOPPED])) {
        console.log("addStreamEventListener: ignored - invalid state");
        return;
      }

      // Check if listener already exists
      const exists = this.streamEventListeners.some(
        (l) => l.targetURL === targetURL && l.eventName === eventName && l.listener === listener,
      );

      if (!exists) {
        this.streamEventListeners = [...this.streamEventListeners, { targetURL, eventName, listener }];
      }

      // Simulate error case: event not found
      setTimeout(() => {
        const errorEvent = this.createStreamEvent({ name: eventName, data: "", text: "", status: "error" });
        listener(errorEvent);

        // Auto-unregister on error as per spec
        this.removeStreamEventListener(targetURL, eventName, listener);
      }, 1000);
    };

    removeStreamEventListener = (targetURL: string, eventName: string, listener: EventListener) => {
      console.log(`removeStreamEventListener(${targetURL}, ${eventName})`);

      this.streamEventListeners = this.streamEventListeners.filter(
        (entry) => !(entry.targetURL === targetURL && entry.eventName === eventName && entry.listener === listener),
      );
    };
  };
