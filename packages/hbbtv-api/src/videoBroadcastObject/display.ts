import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as IORef from "fp-ts/IORef";
import type { EventTarget } from "./eventTarget";

interface Display {
  get width(): number;
  get height(): number;
  get fullScreen(): boolean;
  onFullScreenChange?: () => void;
  setFullScreen(fullScreen: boolean): void;
}

const logger = createLogger("VideoBroadcast/Display");

export const WithDisplay = <T extends ClassType<EventTarget>>(Base: T) =>
  class extends Base implements Display {
    widthRef = IORef.newIORef(0)();
    heightRef = IORef.newIORef(0)();
    fullScreenRef = IORef.newIORef(false)();

    onFullScreenChange?: () => void;

    get width(): number {
      return this.widthRef.read();
    }

    get height(): number {
      return this.heightRef.read();
    }

    get fullScreen(): boolean {
      return this.fullScreenRef.read();
    }

    setFullScreen = (fullScreen: boolean) => {
      logger.info(`setFullScreen(${fullScreen})`);

      const currentFullScreen = this.fullScreenRef.read();
      const changed = currentFullScreen !== fullScreen;
      this.fullScreenRef.write(fullScreen);

      if (changed) {
        this.onFullScreenChange?.();
        this.dispatchEvent(new CustomEvent("FullScreenChange", { detail: { fullScreen } }));
      }
    };
  };
