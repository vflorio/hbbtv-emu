import { type Constructor, logger } from "../utils";
import type { WithEventTarget } from "./eventTarget";

interface WithDisplay {
  width: number;
  height: number;
  fullScreen: boolean;
  onFullScreenChange?: () => void;
  setFullScreen(fullScreen: boolean): void;
}

const log = logger("Display");

export const WithDisplay = <T extends Constructor<WithEventTarget>>(Base: T) =>
  class extends Base implements WithDisplay {
    width = 0;
    height = 0;
    fullScreen = false;

    onFullScreenChange?: () => void;

    setFullScreen = (fullScreen: boolean): void => {
      log(`setFullScreen(${fullScreen})`);

      const changed = this.fullScreen !== fullScreen;
      this.fullScreen = fullScreen;

      if (changed) {
        this.onFullScreenChange?.();
        this.dispatchEvent(new CustomEvent("FullScreenChange", { detail: { fullScreen } }));
      }
    };
  };
