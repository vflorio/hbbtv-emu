import { type Constructor, log } from "../utils";


interface WithDisplay {
  fullScreen: boolean;
  onFullScreenChange?: () => void;
  setFullScreen(fullScreen: boolean): void;
}

export const WithDisplay = <T extends Constructor>(Base: T) =>
  class extends Base implements WithDisplay {
    fullScreen = false;

    onFullScreenChange?: () => void;

    setFullScreen(fullScreen: boolean): void {
      log(`setFullScreen(${fullScreen})`);

      const changed = this.fullScreen !== fullScreen;
      this.fullScreen = fullScreen;

      if (changed) {
        this.onFullScreenChange?.();
        this.dispatchEvent(new CustomEvent("FullScreenChange", { detail: { fullScreen } }));
      }
    }

    dispatchEvent(_event: Event): boolean {
      return false;
    }
  };
