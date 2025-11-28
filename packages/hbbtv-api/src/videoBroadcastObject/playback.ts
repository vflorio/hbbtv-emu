import { type ClassType, createLogger } from "@hbb-emu/lib";
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
  get playState(): PlayState;
  onPlayStateChange?: (state: PlayState, error?: number) => void;
  dispatchPlayStateChange(newState: PlayState, error?: number): void;

  isPlayStateValid(validStates: PlayState[]): boolean;
  stop(): void;
  release(): void;
}

const logger = createLogger("VideoBroadcast/Playback");

export const WithPlayback = <T extends ClassType<VideoElement & EventTarget>>(Base: T) =>
  class extends Base implements Playback {
    playStateRef = IORef.newIORef(PlayState.UNREALIZED)();

    onPlayStateChange?: (state: PlayState, error?: number) => void;

    constructor(...args: any[]) {
      super(...args);

      this.videoElement.addEventListener("PlayStateChange", (event: Event) => {
        this.playStateRef.write((event as CustomEvent).detail as PlayState);
      });
    }

    get playState(): PlayState {
      return this.playStateRef.read();
    }

    dispatchPlayStateChange = (newState: PlayState, error?: number) => {
      const oldState = this.playStateRef.read();
      logger.log(`VideoBroadcast state`, { oldState, newState });
      this.playStateRef.write(newState);

      this.onPlayStateChange?.(newState, error);
      this.dispatchEvent(new CustomEvent("PlayStateChange", { detail: { state: newState, error } }));
    };

    isPlayStateValid = (validStates: PlayState[]) => validStates.includes(this.playStateRef.read());

    stop = () => {
      logger.log("stop");
      if (this.playStateRef.read() === PlayState.UNREALIZED) return;

      this.stopVideo();
    };

    release = () => {
      logger.log("release");
      this.stopVideo();
    };
  };
