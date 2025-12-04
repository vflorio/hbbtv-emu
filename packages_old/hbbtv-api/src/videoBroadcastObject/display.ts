import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as IORef from "fp-ts/IORef";
import type { EventTarget } from "./eventTarget";

export interface Display {
  width: number;
  height: number;
  fullScreen: boolean;
  onFullScreenChange?: () => void;
  setFullScreen: (fullScreen: boolean) => void;
}

const logger = createLogger("VideoBroadcast/Display");

export const WithDisplay = <T extends ClassType<EventTarget>>(Base: T) =>
  class extends Base implements Display {
    widthRef = IORef.newIORef(0)();
    heightRef = IORef.newIORef(0)();
    fullScreenRef = IORef.newIORef(false)();

    width = 0;
    height = 0;
    fullScreen = false;

    onFullScreenChange?: () => void;

    constructor(...args: any[]) {
      super(...args);

      Object.defineProperty(this, "width", {
        get: () => this.widthRef.read(),
        enumerable: true,
        configurable: true,
      });

      Object.defineProperty(this, "height", {
        get: () => this.heightRef.read(),
        enumerable: true,
        configurable: true,
      });

      Object.defineProperty(this, "fullScreen", {
        get: () => this.fullScreenRef.read(),
        enumerable: true,
        configurable: true,
      });
    }

    setFullScreen = (fullScreen: boolean): void => {
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
