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
  readonly name: string;
  readonly data: string;
  readonly text: string;
  readonly status: string;
}

export interface StreamEvent extends CustomEvent<StreamEventDetail> {}

export type AddStreamEventListener = (targetURL: string, eventName: string, listener: EventListener) => void;
export type RemoveStreamEventListener = (targetURL: string, eventName: string, listener: EventListener) => void;
export type GetStreamEventKey = (targetURL: string, eventName: string) => string;
export type RegisterListener = (key: string, listener: EventListener) => void;
export type UnregisterListener = (key: string, listener: EventListener) => void;
export type HasListener = (key: string) => boolean;
export type TrackVersion = (key: string, version: number) => boolean;
export type CreateStreamEvent = (detail: StreamEventDetail) => StreamEvent;
export type ClearAllStreamEventListeners = () => void;
export type DispatchStreamEvent = (
  targetURL: string,
  eventName: string,
  data: string,
  text?: string,
  version?: number,
) => void;
export type DispatchStreamEventError = (targetURL: string, eventName: string, errorMessage?: string) => void;

export interface StreamEvents {
  addStreamEventListener: AddStreamEventListener;
  removeStreamEventListener: RemoveStreamEventListener;
  getStreamEventKey: GetStreamEventKey;
  registerListener: RegisterListener;
  unregisterListener: UnregisterListener;
  hasListener: HasListener;
  trackVersion: TrackVersion;
  createStreamEvent: CreateStreamEvent;
  clearAllStreamEventListeners: ClearAllStreamEventListeners;
  dispatchStreamEvent: DispatchStreamEvent;
  dispatchStreamEventError: DispatchStreamEventError;
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

    getStreamEventKey: GetStreamEventKey = (targetURL, eventName) => `${targetURL}:${eventName}`;

    registerListener: RegisterListener = (key, listener) => {
      const metadata = this.streamEventMetadataRef.read();
      if (!metadata.has(key)) {
        metadata.set(key, new Set());
      }
      metadata.get(key)!.add(listener);
      this.streamEventMetadataRef.write(metadata);
    };

    unregisterListener: UnregisterListener = (key, listener) => {
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

    hasListener: HasListener = (key) => this.streamEventMetadataRef.read().has(key);

    trackVersion: TrackVersion = (key, version) => {
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

    createStreamEvent: CreateStreamEvent = (detail) =>
      new CustomEvent<StreamEventDetail>("StreamEvent", {
        detail,
      });

    addStreamEventListener: AddStreamEventListener = (targetURL, eventName, listener) =>
      pipe(
        logger.info(`addStreamEventListener(${targetURL}, ${eventName})`),
        IO.flatMap(() => () => {
          if (!this.isPlayStateValid([PlayState.PRESENTING, PlayState.STOPPED])) {
            logger.info("addStreamEventListener: ignored - invalid state")();
            return;
          }

          const key = this.getStreamEventKey(targetURL, eventName);
          this.registerListener(key, listener);
          this.addEventListener(eventName, listener);
        }),
      )();

    removeStreamEventListener: RemoveStreamEventListener = (targetURL, eventName, listener) =>
      pipe(
        logger.info(`removeStreamEventListener(${targetURL}, ${eventName})`),
        IO.flatMap(() => () => {
          const key = this.getStreamEventKey(targetURL, eventName);
          this.unregisterListener(key, listener);
          this.removeEventListener(eventName, listener);
        }),
      )();

    clearAllStreamEventListeners: ClearAllStreamEventListeners = () =>
      pipe(
        logger.info("clearAllStreamEventListeners"),
        IO.flatMap(() => () => {
          const metadata = this.streamEventMetadataRef.read();

          pipe(
            Array.from(metadata.entries()),
            RA.flatMap(([key, listeners]) => {
              const [_targetURL, eventName] = key.split(":", 2);
              return Array.from(listeners).map((listener) => () => this.removeEventListener(eventName, listener));
            }),
            RA.map((io) => io()), // eseguo gli IO side‑effect
          );

          this.streamEventMetadataRef.write(new Map());
          this.streamEventVersionsRef.write(new Map());
        }),
      )();

    dispatchStreamEvent: DispatchStreamEvent = (targetURL, eventName, data, text = "", version?) => {
      const key = this.getStreamEventKey(targetURL, eventName);

      if (!this.hasListener(key)) return;

      if (version && !this.trackVersion(key, version)) {
        logger.info(`Stream event ${eventName} version ${version} already received, skipping`);
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

    dispatchStreamEventError: DispatchStreamEventError = (targetURL, eventName, errorMessage = "") => {
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
