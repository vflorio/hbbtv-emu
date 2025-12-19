import { type ClassType, createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { VideoBroadcastEnv } from ".";

const logger = createLogger("VideoBroadcast");

export interface DisplayAPI {
  // State
  fullScreen: OIPF.DAE.Broadcast.VideoBroadcast["fullScreen"];
  width: OIPF.DAE.Broadcast.VideoBroadcast["width"];
  height: OIPF.DAE.Broadcast.VideoBroadcast["height"];

  // Methods
  setFullScreen: OIPF.DAE.Broadcast.VideoBroadcast["setFullScreen"];
}

export const WithDisplay = <T extends ClassType<VideoBroadcastEnv>>(Base: T) =>
  class extends Base implements DisplayAPI {
    _fullScreen = this.env.defaults.fullScreen;
    _width = this.env.defaults.width;
    _height = this.env.defaults.height;

    get fullScreen(): boolean {
      return this._fullScreen;
    }

    get width(): number {
      return this._width;
    }

    set width(value: number) {
      if (!this._fullScreen) {
        this._width = value;
        this.env.setSize(value, this._height)();
      }
    }

    get height(): number {
      return this._height;
    }

    set height(value: number) {
      if (!this._fullScreen) {
        this._height = value;
        this.env.setSize(this._width, value)();
      }
    }

    setFullScreen = (fullscreen: boolean): void => {
      pipe(
        logger.debug("setFullScreen:", fullscreen),
        IO.flatMap(() =>
          IO.of(() => {
            if (this._fullScreen !== fullscreen) {
              this._fullScreen = fullscreen;
              this.env.setFullscreen(fullscreen)();
              this.env.eventHandlers.onFullScreenChange(fullscreen);
            }
          })(),
        ),
      )();
    };
  };
