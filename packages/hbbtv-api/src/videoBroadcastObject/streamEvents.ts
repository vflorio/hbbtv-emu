import { type ClassType, logger } from "../utils";
import type { EventTarget } from "./eventTarget";
import type { Playback } from "./playback";
import { PlayState } from "./playback";

export interface StreamEventDetail {
  readonly name: string;
  readonly data: string;
  readonly text: string;
  readonly status: string;
}

export interface StreamEvent extends CustomEvent<StreamEventDetail> {}

export interface StreamEvents {
  addStreamEventListener(targetURL: string, eventName: string, listener: EventListener): void;
  removeStreamEventListener(targetURL: string, eventName: string, listener: EventListener): void;
}

const log = logger("StreamEvents");

export const WithStreamEvents = <T extends ClassType<Playback & EventTarget>>(Base: T) =>
  class extends Base implements StreamEvents {
    // Map to track targetURL+eventName combinations
    // Stores metadata about registered stream event listeners
    streamEventMetadata = new Map<string, Set<EventListener>>();

    // Track last received stream event versions to avoid duplicate dispatches
    // Key: targetURL:eventName, Value: Set of version numbers
    streamEventVersions = new Map<string, Set<number>>();

    constructor(...args: any[]) {
      super(...args);
      this.augmentDispatchPlayStateChange();
    }

    augmentDispatchPlayStateChange = () => {
      const originalDispatchPlayStateChange = this.dispatchPlayStateChange.bind(this);

      this.dispatchPlayStateChange = (newState: PlayState, error?: number) => {
        const oldState = this.playState;

        if (newState === PlayState.UNREALIZED) {
          this.clearAllStreamEventListeners();
        }

        if (newState === PlayState.CONNECTING && oldState === PlayState.PRESENTING) {
          this.clearAllStreamEventListeners();
        }

        originalDispatchPlayStateChange(newState, error);
      };
    };

    getStreamEventKey = (targetURL: string, eventName: string) => `${targetURL}:${eventName}`;

    registerListener = (key: string, listener: EventListener) => {
      if (!this.streamEventMetadata.has(key)) {
        this.streamEventMetadata.set(key, new Set());
      }
      this.streamEventMetadata.get(key)!.add(listener);
    };

    unregisterListener = (key: string, listener: EventListener) => {
      if (!this.streamEventMetadata.has(key)) return;
      this.streamEventMetadata.get(key)!.delete(listener);

      if (this.streamEventMetadata.get(key)!.size !== 0) return;
      this.streamEventMetadata.delete(key);
      this.streamEventVersions.delete(key);
    };

    hasListener = (key: string) => this.streamEventMetadata.has(key);

    trackVersion = (key: string, version: number): boolean => {
      if (!this.streamEventVersions.has(key)) {
        this.streamEventVersions.set(key, new Set());
      }

      const versions = this.streamEventVersions.get(key);
      if (versions?.has(version)) {
        return false; // Version already tracked
      }
      versions?.add(version);
      return true; // New version tracked
    };

    createStreamEvent = (detail: StreamEventDetail): StreamEvent =>
      new CustomEvent<StreamEventDetail>("StreamEvent", {
        detail,
      });

    addStreamEventListener = (targetURL: string, eventName: string, listener: EventListener) => {
      log(`addStreamEventListener(${targetURL}, ${eventName})`);

      if (!this.isPlayStateValid([PlayState.PRESENTING, PlayState.STOPPED])) {
        log("addStreamEventListener: ignored - invalid state");
        return;
      }

      const key = this.getStreamEventKey(targetURL, eventName);

      this.registerListener(key, listener);

      this.addEventListener(eventName, listener);
    };

    removeStreamEventListener = (targetURL: string, eventName: string, listener: EventListener) => {
      log(`removeStreamEventListener(${targetURL}, ${eventName})`);

      const key = this.getStreamEventKey(targetURL, eventName);

      this.unregisterListener(key, listener);

      this.removeEventListener(eventName, listener);
    };

    clearAllStreamEventListeners = () => {
      log("clearAllStreamEventListeners");

      for (const [key, listeners] of this.streamEventMetadata.entries()) {
        const [_targetURL, eventName] = key.split(":", 2);
        for (const listener of listeners) {
          this.removeEventListener(eventName, listener);
        }
      }

      this.streamEventMetadata.clear();
      this.streamEventVersions.clear();
    };

    dispatchStreamEvent = (targetURL: string, eventName: string, data: string, text: string = "", version?: number) => {
      const key = this.getStreamEventKey(targetURL, eventName);

      if (!this.hasListener(key)) return;

      if (version && !this.trackVersion(key, version)) {
        log(`Stream event ${eventName} version ${version} already received, skipping`);
        return;
      }

      const event = this.createStreamEvent({
        name: eventName,
        data,
        text,
        status: "trigger",
      });

      this.dispatchEvent(event);
    };

    dispatchStreamEventError = (targetURL: string, eventName: string, errorMessage: string = "") => {
      const key = this.getStreamEventKey(targetURL, eventName);

      if (!this.hasListener(key)) return;

      const errorEvent = this.createStreamEvent({
        name: eventName,
        data: "",
        text: errorMessage,
        status: "error",
      });

      this.dispatchEvent(errorEvent);

      const listeners = Array.from(this.streamEventMetadata.get(key) || []);
      for (const listener of listeners) {
        this.removeStreamEventListener(targetURL, eventName, listener);
      }
    };
  };
