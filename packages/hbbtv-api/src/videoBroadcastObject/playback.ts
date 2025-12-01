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

export type OnPlayStateChange = (state: PlayState, error?: number) => void;
export type DispatchPlayStateChange = (newState: PlayState, error?: number) => IO.IO<void>;
export type IsPlayStateValid = (validStates: PlayState[]) => boolean;

export interface Playback {
  readonly playState: PlayState;
  onPlayStateChange?: OnPlayStateChange;
  dispatchPlayStateChange: DispatchPlayStateChange;
  isPlayStateValid: IsPlayStateValid;
  stop: () => void;
  release: () => void;
}

const logger = createLogger("VideoBroadcast/Playback");

export const WithPlayback = <T extends ClassType<VideoElement & EventTarget>>(Base: T) =>
  class extends Base implements Playback {
    playStateRef = IORef.newIORef(PlayState.UNREALIZED)();

    onPlayStateChange?: OnPlayStateChange;

    constructor(...args: any[]) {
      super(...args);

      this.videoElement.addEventListener("PlayStateChange", (event: Event) => {
        this.playStateRef.write((event as CustomEvent).detail as PlayState);
      });
    }

    get playState(): PlayState {
      return this.playStateRef.read();
    }

    dispatchPlayStateChange: DispatchPlayStateChange = (newState, error?) =>
      pipe(
        logger.info(`dispatchPlayStateChange`, { newState }),
        IO.flatMap(() => () => {
          this.playStateRef.write(newState);
          this.onPlayStateChange?.(newState, error);
          this.dispatchEvent(new CustomEvent("PlayStateChange", { detail: { state: newState, error } }));
        }),
      );

    isPlayStateValid: IsPlayStateValid = (validStates) =>
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
