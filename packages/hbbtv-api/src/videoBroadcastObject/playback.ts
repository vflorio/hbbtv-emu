import { type ClassType, logger } from "@hbb-emu/lib";
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
  dispatchPlayStateChange(newState: PlayState, error?: number): void;

  isPlayStateValid(validStates: PlayState[]): boolean;
  stop(): void;
  release(): void;
}

const log = logger("Playback");

export const WithPlayback = <T extends ClassType<VideoElement & EventTarget>>(Base: T) =>
  class extends Base implements Playback {
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

    dispatchPlayStateChange = (newState: PlayState, error?: number) => {
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

    release = () => {
      log("release");
      this.videoChannel.release();
    };
  };
