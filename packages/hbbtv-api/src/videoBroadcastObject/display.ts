import { type ClassType, logger } from "@hbb-emu/lib";
import type { EventTarget } from "./eventTarget";

interface Display {
  width: number;
  height: number;
  fullScreen: boolean;
  onFullScreenChange?: () => void;
  setFullScreen(fullScreen: boolean): void;
}

const log = logger("Display");

export const WithDisplay = <T extends ClassType<EventTarget>>(Base: T) =>
  class extends Base implements Display {
    width = 0;
    height = 0;
    fullScreen = false;

    onFullScreenChange?: () => void;

    setFullScreen = (fullScreen: boolean) => {
      log(`setFullScreen(${fullScreen})`);

      const changed = this.fullScreen !== fullScreen;
      this.fullScreen = fullScreen;

      if (changed) {
        this.onFullScreenChange?.();
        this.dispatchEvent(new CustomEvent("FullScreenChange", { detail: { fullScreen } }));
      }
    };
  };
