import { type Constructor, log } from "../utils";

export enum PlayState {
  UNREALIZED = 0,
  CONNECTING = 1,
  PRESENTING = 2,
  STOPPED = 3,
}

export interface WithPlayback {
  playState: PlayState;
  onPlayStateChange?: (state: PlayState, error?: number) => void;

  isPlayStateValid(validStates: PlayState[]): boolean;
  stop(): void;
  release(): void;
  dispatchPlayStateChange(newState: PlayState, error?: number): void;
}

export const WithPlayback = <T extends Constructor>(Base: T) =>
  class extends Base implements WithPlayback {
    playState: PlayState = PlayState.UNREALIZED;
    onPlayStateChange?: (state: PlayState, error?: number) => void;

    isPlayStateValid(validStates: PlayState[]): boolean {
      return validStates.includes(this.playState);
    }

    dispatchPlayStateChange(newState: PlayState, error?: number): void {
      const oldState = this.playState;
      this.playState = newState;

      log(`VideoBroadcast state: ${oldState} -> ${newState}`);

      this.onPlayStateChange?.(newState, error);
      this.dispatchEvent(new CustomEvent("PlayStateChange", { detail: { state: newState, error } }));
    }

    stop(): void {
      log("stop");

      if (this.playState !== PlayState.UNREALIZED) {
        this.dispatchPlayStateChange(PlayState.STOPPED);
      }
    }

    release(): void {
      log("release");
      this.dispatchPlayStateChange(PlayState.UNREALIZED);
    }

    dispatchEvent(_event: Event): boolean {
      return false;
    }
  };
