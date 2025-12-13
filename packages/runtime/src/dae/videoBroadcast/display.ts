import { type ClassType, createLogger } from "@hbb-emu/core";
import { DEFAULT_FULL_SCREEN, DEFAULT_VIDEO_HEIGHT, DEFAULT_VIDEO_WIDTH, type OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { ObjectVideoStream } from "../../providers/videoStream/objectVideoStream";

const logger = createLogger("VideoBroadcast");

export interface DisplayAPI {
  // State
  fullScreen: OIPF.DAE.Broadcast.VideoBroadcast["fullScreen"];
  width: OIPF.DAE.Broadcast.VideoBroadcast["width"];
  height: OIPF.DAE.Broadcast.VideoBroadcast["height"];
  // Events
  onfocus: OIPF.DAE.Broadcast.VideoBroadcast["onfocus"];
  onblur: OIPF.DAE.Broadcast.VideoBroadcast["onblur"];
  onFullScreenChange: OIPF.DAE.Broadcast.VideoBroadcast["onFullScreenChange"];

  // Methods
  setFullScreen: OIPF.DAE.Broadcast.VideoBroadcast["setFullScreen"];
}

export const WithDisplayAPI = <T extends ClassType<ObjectVideoStream>>(Base: T) =>
  class extends Base implements DisplayAPI {
    onfocus: OIPF.DAE.Broadcast.OnFocusHandler | null = null;
    onblur: OIPF.DAE.Broadcast.OnBlurHandler | null = null;

    _fullScreen = DEFAULT_FULL_SCREEN;
    _width = DEFAULT_VIDEO_WIDTH;
    _height = DEFAULT_VIDEO_HEIGHT;

    get fullScreen(): boolean {
      return this._fullScreen;
    }

    get width(): number {
      return this._width;
    }

    set width(value: number) {
      if (!this._fullScreen) {
        this._width = value;
        this.videoStreamSetSize(value, this._height);
      }
    }

    get height(): number {
      return this._height;
    }

    set height(value: number) {
      if (!this._fullScreen) {
        this._height = value;
        this.videoStreamSetSize(this._width, value);
      }
    }

    onFullScreenChange: OIPF.DAE.Broadcast.OnFullScreenChangeHandler | null = null;

    setFullScreen = (fullscreen: boolean): void => {
      pipe(
        logger.debug("setFullScreen:", fullscreen),
        IO.flatMap(() =>
          IO.of(() => {
            if (this._fullScreen !== fullscreen) {
              this._fullScreen = fullscreen;
              this.videoStreamSetFullscreen(fullscreen);
              this.onFullScreenChange?.();
            }
          })(),
        ),
      )();
    };
  };
