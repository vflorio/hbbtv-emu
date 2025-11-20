import { type ClassType, logger } from "../utils";
import type { WithEventTarget } from "./eventTarget";
import type { WithVideoElement } from "./videoElement";

export enum PlayState {
  UNREALIZED = 0,
  CONNECTING = 1,
  PRESENTING = 2,
  STOPPED = 3,
}

export interface WithPlayback {
  playState: PlayState;
  onPlayStateChange?: (state: PlayState, error?: number) => void;
  dispatchPlayStateChange(newState: PlayState, error?: number): void;

  isPlayStateValid(validStates: PlayState[]): boolean;
  stop(): void;
  release(): void;
}

const log = logger("Playback");

export const WithPlayback = <T extends ClassType<WithVideoElement & WithEventTarget>>(Base: T) =>
  class extends Base implements WithPlayback {
    playState: PlayState = PlayState.UNREALIZED;

    onPlayStateChange?: (state: PlayState, error?: number) => void;

    constructor(...args: any[]) {
      super(...args);

      this.videoChannel.setCallbacks({
        onPlayStateChange: (state) => {
          this.dispatchPlayStateChange(state);
        },
      });
    }

    isPlayStateValid = (validStates: PlayState[]) => validStates.includes(this.playState);

    dispatchPlayStateChange = (newState: PlayState, error?: number): void => {
      const oldState = this.playState;
      this.playState = newState;

      log(`VideoBroadcast state: ${oldState} -> ${newState}`);

      this.onPlayStateChange?.(newState, error);
      this.dispatchEvent(new CustomEvent("PlayStateChange", { detail: { state: newState, error } }));
    };

    stop = () => {
      log("stop");
      if (this.playState === PlayState.UNREALIZED) return;

      this.videoChannel.stop();
    };

    release = (): void => {
      log("release");
      this.videoChannel.release();
    };
  };
