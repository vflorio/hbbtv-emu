import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import * as IORef from "fp-ts/IORef";
import { pipe } from "fp-ts/function";
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

const logger = createLogger("VideoBroadcast/StreamEvents");

export const WithStreamEvents = <T extends ClassType<Playback & EventTarget>>(Base: T) =>
  class extends Base implements StreamEvents {
    streamEventMetadataRef = IORef.newIORef<Map<string, Set<EventListener>>>(new Map())();
    streamEventVersionsRef = IORef.newIORef<Map<string, Set<number>>>(new Map())();

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
      const metadata = this.streamEventMetadataRef.read();
      if (!metadata.has(key)) {
        metadata.set(key, new Set());
      }
      metadata.get(key)!.add(listener);
      this.streamEventMetadataRef.write(metadata);
    };

    unregisterListener = (key: string, listener: EventListener) => {
      const metadata = this.streamEventMetadataRef.read();
      if (!metadata.has(key)) return;

      metadata.get(key)!.delete(listener);

      if (metadata.get(key)!.size === 0) {
        metadata.delete(key);
        const versions = this.streamEventVersionsRef.read();
        versions.delete(key);
        this.streamEventVersionsRef.write(versions);
      }

      this.streamEventMetadataRef.write(metadata);
    };

    hasListener = (key: string) => this.streamEventMetadataRef.read().has(key);

    trackVersion = (key: string, version: number): boolean => {
      const versions = this.streamEventVersionsRef.read();

      if (!versions.has(key)) {
        versions.set(key, new Set());
      }

      const versionSet = versions.get(key);
      if (versionSet?.has(version)) {
        return false;
      }

      versionSet?.add(version);
      this.streamEventVersionsRef.write(versions);
      return true;
    };

    createStreamEvent = (detail: StreamEventDetail): StreamEvent =>
      new CustomEvent<StreamEventDetail>("StreamEvent", {
        detail,
      });

    addStreamEventListener = (targetURL: string, eventName: string, listener: EventListener) => {
      logger.log(`addStreamEventListener(${targetURL}, ${eventName})`);

      if (!this.isPlayStateValid([PlayState.PRESENTING, PlayState.STOPPED])) {
        logger.log("addStreamEventListener: ignored - invalid state");
        return;
      }

      const key = this.getStreamEventKey(targetURL, eventName);
      this.registerListener(key, listener);
      this.addEventListener(eventName, listener);
    };

    removeStreamEventListener = (targetURL: string, eventName: string, listener: EventListener) => {
      logger.log(`removeStreamEventListener(${targetURL}, ${eventName})`);

      const key = this.getStreamEventKey(targetURL, eventName);
      this.unregisterListener(key, listener);
      this.removeEventListener(eventName, listener);
    };

    clearAllStreamEventListeners = () => {
      logger.log("clearAllStreamEventListeners");

      const metadata = this.streamEventMetadataRef.read();

      pipe(
        Array.from(metadata.entries()),
        A.map(([key, listeners]) => {
          const [_targetURL, eventName] = key.split(":", 2);
          Array.from(listeners).forEach((listener) => this.removeEventListener(eventName, listener));
        }),
      );

      this.streamEventMetadataRef.write(new Map());
      this.streamEventVersionsRef.write(new Map());
    };

    dispatchStreamEvent = (targetURL: string, eventName: string, data: string, text: string = "", version?: number) => {
      const key = this.getStreamEventKey(targetURL, eventName);

      if (!this.hasListener(key)) return;

      if (version && !this.trackVersion(key, version)) {
        logger.log(`Stream event ${eventName} version ${version} already received, skipping`);
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

      const metadata = this.streamEventMetadataRef.read();
      pipe(
        Array.from(metadata.get(key) || []),
        A.map((listener) => this.removeStreamEventListener(targetURL, eventName, listener)),
      );
    };
  };
