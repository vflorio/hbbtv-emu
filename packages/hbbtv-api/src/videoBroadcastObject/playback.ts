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

export namespace Playback {
  export interface Contract {
    readonly playState: PlayState;
    onPlayStateChange?: OnPlayStateChange;
    dispatchPlayStateChange: DispatchPlayStateChange;
    isPlayStateValid: IsPlayStateValid;
    stop: Stop;
    release: Release;
  }

  export type OnPlayStateChange = (state: PlayState, error?: number) => void;
  export type DispatchPlayStateChange = (newState: PlayState, error?: number) => IO.IO<void>;
  export type IsPlayStateValid = (validStates: PlayState[]) => boolean;
  export type Stop = () => void;
  export type Release = () => void;
}

const logger = createLogger("VideoBroadcast/Playback");

export const WithPlayback = <T extends ClassType<VideoElement.Contract & EventTarget.Contract>>(Base: T) =>
  class extends Base implements Playback.Contract {
    playStateRef = IORef.newIORef(PlayState.UNREALIZED)();

    onPlayStateChange?: Playback.OnPlayStateChange;

    constructor(...args: any[]) {
      super(...args);

      this.videoElement.addEventListener("PlayStateChange", (event: Event) => {
        this.playStateRef.write((event as CustomEvent).detail as PlayState);
      });
    }

    get playState(): PlayState {
      return this.playStateRef.read();
    }

    dispatchPlayStateChange: Playback.DispatchPlayStateChange = (newState, error?) =>
      pipe(
        logger.info(`dispatchPlayStateChange`, { newState }),
        IO.flatMap(() => () => {
          this.playStateRef.write(newState);
          this.onPlayStateChange?.(newState, error);
          this.dispatchEvent(new CustomEvent("PlayStateChange", { detail: { state: newState, error } }));
        }),
      );

    isPlayStateValid: Playback.IsPlayStateValid = (validStates) =>
      pipe(this.playStateRef.read(), (currentState) => validStates.includes(currentState));

    stop: Playback.Stop = () =>
      pipe(
        logger.info("stop"),
        IO.flatMap(() => () => {
          if (this.playStateRef.read() === PlayState.UNREALIZED) return;
          this.stopVideo();
        }),
      )();

    release: Playback.Release = () =>
      pipe(
        logger.info("release"),
        IO.flatMap(() => () => this.stopVideo()),
      )();
  };
