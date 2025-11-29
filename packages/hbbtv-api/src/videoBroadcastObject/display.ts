import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as IORef from "fp-ts/IORef";
import type { EventTarget } from "./eventTarget";

export namespace Display {
  export interface Contract {
    readonly width: number;
    readonly height: number;
    readonly fullScreen: boolean;
    onFullScreenChange?: OnFullScreenChange;
    setFullScreen: SetFullScreen;
  }

  export type OnFullScreenChange = () => void;
  export type SetFullScreen = (fullScreen: boolean) => void;
}

const logger = createLogger("VideoBroadcast/Display");

export const WithDisplay = <T extends ClassType<EventTarget.Contract>>(Base: T) =>
  class extends Base implements Display.Contract {
    widthRef = IORef.newIORef(0)();
    heightRef = IORef.newIORef(0)();
    fullScreenRef = IORef.newIORef(false)();

    onFullScreenChange?: Display.OnFullScreenChange;

    get width(): number {
      return this.widthRef.read();
    }

    get height(): number {
      return this.heightRef.read();
    }

    get fullScreen(): boolean {
      return this.fullScreenRef.read();
    }

    setFullScreen: Display.SetFullScreen = (fullScreen) => {
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
