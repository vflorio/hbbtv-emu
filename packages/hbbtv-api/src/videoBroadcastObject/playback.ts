import { type ClassType, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import type { EventTarget } from "./eventTarget";
import type { VideoElement } from "./videoElement";

export enum PlayState {
  UNREALIZED = 0,
  CONNECTING = 1,
  PRESENTING = 2,
  STOPPED = 3,
}

export interface Playback {
  playState: PlayState;
  onPlayStateChange?: (state: PlayState, error?: number) => void;
  dispatchPlayStateChange: (newState: PlayState, error?: number) => IO.IO<void>;
  isPlayStateValid: (validStates: PlayState[]) => boolean;
  stop: () => void;
  release: () => void;
}

const logger = createLogger("VideoBroadcast/Playback");

export const WithPlayback = <T extends ClassType<VideoElement & EventTarget>>(Base: T) =>
  class extends Base implements Playback {
    playState: PlayState = PlayState.UNREALIZED;
    playStateRef = IORef.newIORef(PlayState.UNREALIZED)();

    onPlayStateChange?: (state: PlayState, error?: number) => void;

    constructor(...args: any[]) {
      super(...args);

      Object.defineProperty(this, "playState", {
        get: () => this.playStateRef.read(),
        enumerable: true,
        configurable: true,
      });

      this.videoElement.addEventListener("PlayStateChange", (event: Event) => {
        this.playStateRef.write((event as CustomEvent).detail as PlayState);
      });
    }

    dispatchPlayStateChange = (newState: PlayState, error?: number): IO.IO<void> =>
      pipe(
        logger.info(`dispatchPlayStateChange`, { newState }),
        IO.flatMap(() => () => {
          this.playStateRef.write(newState);
          this.onPlayStateChange?.(newState, error);
          this.dispatchEvent(new CustomEvent("PlayStateChange", { detail: { state: newState, error } }));
        }),
      );

    isPlayStateValid = (validStates: PlayState[]) =>
      pipe(this.playStateRef.read(), (currentState) => validStates.includes(currentState));

    stop: () => void = () =>
      pipe(
        logger.info("stop"),
        IO.flatMap(() => () => {
          if (this.playStateRef.read() === PlayState.UNREALIZED) return;
          this.stopVideo();
        }),
      )();

    release: () => void = () =>
      pipe(
        logger.info("release"),
        IO.flatMap(() => () => this.stopVideo()),
      )();
  };
