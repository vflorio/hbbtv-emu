import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as RA from "fp-ts/ReadonlyArray";
import type { EventTarget } from "./eventTarget";
import type { Playback } from "./playback";
import { PlayState } from "./playback";
import type { VideoElement } from "./videoElement";

export interface StreamEventDetail {
  name: string;
  data: string;
  text: string;
  status: string;
}

export interface StreamEvent extends CustomEvent<StreamEventDetail> {}

export interface StreamEvents {
  addStreamEventListener: (targetURL: string, eventName: string, listener: EventListener) => void;
  removeStreamEventListener: (targetURL: string, eventName: string, listener: EventListener) => void;
  getStreamEventKey: (targetURL: string, eventName: string) => string;
  registerListener: (key: string, listener: EventListener) => void;
  unregisterListener: (key: string, listener: EventListener) => void;
  hasListener: (key: string) => boolean;
  trackVersion: (key: string, version: number) => boolean;
  createStreamEvent: (eventName: string, detail: StreamEventDetail) => StreamEvent;
  clearAllStreamEventListeners: () => void;
  dispatchStreamEvent: (targetURL: string, eventName: string, data: string, text?: string, version?: number) => void;
  dispatchStreamEventError: (targetURL: string, eventName: string, errorMessage?: string) => void;
}

const logger = createLogger("VideoBroadcast/StreamEvents");

export const WithStreamEvents = <T extends ClassType<Playback & EventTarget & VideoElement>>(Base: T) =>
  class extends Base implements StreamEvents {
    streamEventMetadataRef = IORef.newIORef<Map<string, Set<EventListener>>>(new Map())();
    streamEventVersionsRef = IORef.newIORef<Map<string, Set<number>>>(new Map())();

    constructor(...args: any[]) {
      super(...args);

      this.videoElement.addEventListener("PlayStateChange", () => {
        const isValidState = this.isPlayStateValid([PlayState.UNREALIZED, PlayState.CONNECTING]);
        if (!isValidState) return;
        this.clearAllStreamEventListeners();
      });
    }

    getStreamEventKey = (targetURL: string, eventName: string): string => `${targetURL}:${eventName}`;

    registerListener = (key: string, listener: EventListener): void => {
      const metadata = this.streamEventMetadataRef.read();
      if (!metadata.has(key)) {
        metadata.set(key, new Set());
      }
      metadata.get(key)!.add(listener);
      this.streamEventMetadataRef.write(metadata);
    };

    unregisterListener = (key: string, listener: EventListener): void => {
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

    hasListener = (key: string): boolean => this.streamEventMetadataRef.read().has(key);

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

    createStreamEvent = (eventName: string, detail: StreamEventDetail): StreamEvent =>
      new CustomEvent<StreamEventDetail>(eventName, {
        detail,
      });

    addStreamEventListener = (targetURL: string, eventName: string, listener: EventListener): void =>
      pipe(
        logger.info(`addStreamEventListener(${targetURL}, ${eventName})`),
        IO.flatMap(() => () => {
          // TODO FIXME
          //  if (!this.isPlayStateValid([PlayState.PRESENTING, PlayState.STOPPED])) {
          //    logger.info("addStreamEventListener: ignored - invalid state")();
          //    return;
          //  }

          const key = this.getStreamEventKey(targetURL, eventName);
          this.registerListener(key, listener);
          this.addEventListener(eventName, listener);
        }),
      )();

    removeStreamEventListener = (targetURL: string, eventName: string, listener: EventListener): void =>
      pipe(
        logger.info(`removeStreamEventListener(${targetURL}, ${eventName})`),
        IO.flatMap(() => () => {
          const key = this.getStreamEventKey(targetURL, eventName);
          this.unregisterListener(key, listener);
          this.removeEventListener(eventName, listener);
        }),
      )();

    clearAllStreamEventListeners = (): void =>
      pipe(
        IO.Do,
        IO.flatMap(() => () => {
          const metadata = this.streamEventMetadataRef.read();

          pipe(
            Array.from(metadata.entries()),
            RA.flatMap(([key, listeners]) => {
              const [_targetURL, eventName] = key.split(":", 2);
              return Array.from(listeners).map((listener) => () => this.removeEventListener(eventName, listener));
            }),
            RA.map((io) => io()),
          );

          this.streamEventMetadataRef.write(new Map());
          this.streamEventVersionsRef.write(new Map());
        }),
      )();

    dispatchStreamEvent = (targetURL: string, eventName: string, data: string, text = "", version?: number): void => {
      const key = this.getStreamEventKey(targetURL, eventName);

      if (!this.hasListener(key)) return;

      if (version && !this.trackVersion(key, version)) {
        logger.info(`Stream event ${eventName} version ${version} already received, skipping`);
        return;
      }

      const event = this.createStreamEvent(eventName, {
        name: eventName,
        data,
        text,
        status: "trigger",
      });

      this.dispatchEvent(event);
    };

    dispatchStreamEventError = (targetURL: string, eventName: string, errorMessage = ""): void => {
      const key = this.getStreamEventKey(targetURL, eventName);

      if (!this.hasListener(key)) return;

      const errorEvent = this.createStreamEvent(eventName, {
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
