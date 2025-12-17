import { type ClassType, createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";
import type { VideoBroadcastEnv } from ".";

const logger = createLogger("VideoBroadcast:StreamEvent");

export interface StreamEventAPI {
  _streamEventListeners: unknown[];
  addStreamEventListener: OIPF.DAE.Broadcast.VideoBroadcast["addStreamEventListener"];
  removeStreamEventListener: OIPF.DAE.Broadcast.VideoBroadcast["removeStreamEventListener"];
}

export const WithStreamEvent = <T extends ClassType<VideoBroadcastEnv>>(Base: T) =>
  class extends Base implements StreamEventAPI {
    _streamEventListeners: unknown[] = [];

    #subscriptions = new Map<
      string,
      {
        targetURL: string;
        eventName: string;
        listener: OIPF.DAE.Broadcast.StreamEventListener;
        unsubscribe: IO.IO<void>;
      }
    >();

    #refreshListenerState = (): void => {
      this._streamEventListeners = [...this.#subscriptions.values()].map((s) => ({
        targetURL: s.targetURL,
        eventName: s.eventName,
      }));
    };

    addStreamEventListener = (
      _targetURL: string,
      _eventName: string,
      _listener: OIPF.DAE.Broadcast.StreamEventListener,
    ): void => {
      const targetURL = _targetURL;
      const eventName = _eventName;
      const listener = _listener;

      logger.debug("addStreamEventListener", targetURL, eventName)();

      // Allow multiple registrations of the same listener; key by identity.
      const key = `${targetURL}::${eventName}::${String(this.#subscriptions.size)}::${Date.now()}`;
      const subscription = this.env.streamEventScheduler.addListener(targetURL, eventName, listener)();
      const unsubscribe = subscription.unsubscribe;
      this.#subscriptions.set(key, { targetURL, eventName, listener, unsubscribe });
      this.#refreshListenerState();
    };

    removeStreamEventListener = (
      _targetURL: string,
      _eventName: string,
      _listener: OIPF.DAE.Broadcast.StreamEventListener,
    ): void => {
      const targetURL = _targetURL;
      const eventName = _eventName;
      const listener = _listener;

      logger.debug("removeStreamEventListener", targetURL, eventName)();

      for (const [key, sub] of this.#subscriptions) {
        if (sub.targetURL !== targetURL) continue;
        if (sub.eventName !== eventName) continue;
        if (sub.listener !== listener) continue;
        sub.unsubscribe();
        this.#subscriptions.delete(key);
        break;
      }

      this.#refreshListenerState();
    };
  };
