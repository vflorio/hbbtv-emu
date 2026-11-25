/**
 * video/broadcast — display
 *
 * OIPF DAE `width`, `height`, `fullScreen`, `setFullScreen()` and `onFullScreenChange`.
 *
 * Reader-style module (ROADMAP D1), same shape as `./volume.ts`:
 * - `fullScreen` lives in an injected `IORef`;
 * - `VideoWindow` is the box the video is rendered in. Its size is read live: per spec,
 *   `width`/`height` are the object's `style.width`/`style.height`, so whatever else
 *   changes them (CSS, the application touching the style) is reflected;
 * - `DisplayEvents` notifies the application.
 *
 * Rules:
 * - `width` / `height` are writable by the application only while not in full-screen;
 * - full-screen does not change the object's own size, so leaving it restores the window;
 * - `onFullScreenChange` fires only when `fullScreen` actually changes, whoever changes it
 *   (the application or the settings UI).
 */

import type { ClassType } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type * as R from "fp-ts/Reader";
import * as RIO from "fp-ts/ReaderIO";
import type { VideoBroadcastEnv } from ".";

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

export type Size = Readonly<{ width: number; height: number }>;

export type DisplayState = Readonly<{ fullScreen: boolean }> & Size;

/** The box the video is rendered in. */
export type VideoWindow = Readonly<{
  getSize: IO.IO<Size>;
  setWidth: (width: number) => IO.IO<void>;
  setHeight: (height: number) => IO.IO<void>;
  setFullScreen: (fullScreen: boolean) => IO.IO<void>;
}>;

export type DisplayEvents = Readonly<{
  onFullScreenChange: (fullScreen: boolean) => IO.IO<void>;
}>;

export type DisplayEnv = Readonly<{
  fullScreenState: IORef<boolean>;
  videoWindow: VideoWindow;
  displayEvents: DisplayEvents;
}>;

export const createDisplayEnv = (
  videoWindow: VideoWindow,
  displayEvents: DisplayEvents,
  initialFullScreen = false,
): IO.IO<DisplayEnv> =>
  pipe(
    newIORef(initialFullScreen),
    IO.map((fullScreenState) => ({ fullScreenState, videoWindow, displayEvents })),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** A size in pixels: a finite, non-negative number, truncated to an integer. */
export const parseDimension = (input: unknown): O.Option<number> =>
  pipe(
    O.fromPredicate((value: unknown): value is number => typeof value === "number" && Number.isFinite(value))(input),
    O.map(Math.trunc),
    O.filter((value) => value >= 0),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

export const isFullScreen: RIO.ReaderIO<DisplayEnv, boolean> = ({ fullScreenState }) => fullScreenState.read;

export const getSize: RIO.ReaderIO<DisplayEnv, Size> = ({ videoWindow }) => videoWindow.getSize;

export const readDisplayState: RIO.ReaderIO<DisplayEnv, DisplayState> = pipe(
  RIO.Do,
  RIO.bind("fullScreen", () => isFullScreen),
  RIO.bind("size", () => getSize),
  RIO.map(({ fullScreen, size }) => ({ fullScreen, ...size })),
);

const noop: RIO.ReaderIO<DisplayEnv, void> = RIO.of(undefined);

const writeFullScreen =
  (fullScreen: boolean): RIO.ReaderIO<DisplayEnv, void> =>
  ({ fullScreenState, videoWindow, displayEvents }) =>
    pipe(
      fullScreenState.write(fullScreen),
      IO.flatMap(() => videoWindow.setFullScreen(fullScreen)),
      IO.flatMap(() => displayEvents.onFullScreenChange(fullScreen)),
    );

/** `setFullScreen(fullScreen)`: no-op if the mode does not change. */
export const setFullScreen = (fullScreen: boolean): RIO.ReaderIO<DisplayEnv, void> =>
  pipe(
    isFullScreen,
    RIO.flatMap((current) => (current === Boolean(fullScreen) ? noop : writeFullScreen(Boolean(fullScreen)))),
  );

type Dimension = keyof Size;

const writeDimension =
  (key: Dimension, value: number): RIO.ReaderIO<DisplayEnv, void> =>
  ({ videoWindow }) =>
    key === "width" ? videoWindow.setWidth(value) : videoWindow.setHeight(value);

/** Valid and different from the current value. */
const changedDimension = (key: Dimension, input: unknown): RIO.ReaderIO<DisplayEnv, O.Option<number>> =>
  pipe(
    getSize,
    RIO.map((size) =>
      pipe(
        parseDimension(input),
        O.filter((value) => value !== size[key]),
      ),
    ),
  );

/** Application write to `width` / `height`: ignored while in full-screen. */
const setDimension =
  (key: Dimension) =>
  (input: number): RIO.ReaderIO<DisplayEnv, void> =>
    pipe(
      isFullScreen,
      RIO.flatMap((fullScreen) => (fullScreen ? RIO.of(O.none) : changedDimension(key, input))),
      RIO.flatMap(
        O.match(
          () => noop,
          (value) => writeDimension(key, value),
        ),
      ),
    );

export const setWidth = setDimension("width");
export const setHeight = setDimension("height");

/**
 * Applies external state (settings UI, scenario).
 * Unlike the application, external state may resize the window while in full-screen:
 * the object keeps that size and shows it when leaving full-screen.
 */
export const applyDisplayState = (patch: Partial<DisplayState>): RIO.ReaderIO<DisplayEnv, void> => {
  const applyDimension = (key: Dimension): RIO.ReaderIO<DisplayEnv, void> =>
    patch[key] === undefined
      ? noop
      : pipe(
          changedDimension(key, patch[key]),
          RIO.flatMap(
            O.match(
              () => noop,
              (value) => writeDimension(key, value),
            ),
          ),
        );

  return pipe(
    applyDimension("width"),
    RIO.flatMap(() => applyDimension("height")),
    RIO.flatMap(() => (patch.fullScreen === undefined ? noop : setFullScreen(patch.fullScreen))),
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OIPF surface
// ─────────────────────────────────────────────────────────────────────────────

export type DisplayApi = Pick<OIPF.DAE.Broadcast.VideoBroadcast, "setFullScreen" | "width" | "height"> &
  Readonly<Pick<OIPF.DAE.Broadcast.VideoBroadcast, "fullScreen">>;

/** The properties and methods exposed to HbbTV applications. */
export const displayApi: R.Reader<DisplayEnv, DisplayApi> = (env) => ({
  setFullScreen: (fullScreen) => setFullScreen(fullScreen)(env)(),
  get fullScreen() {
    return isFullScreen(env)();
  },
  get width() {
    return getSize(env)().width;
  },
  set width(value: number) {
    setWidth(value)(env)();
  },
  get height() {
    return getSize(env)().height;
  },
  set height(value: number) {
    setHeight(value)(env)();
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Transitional bridge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plugs the Reader module into the VideoBroadcast class while the rest of it is
 * still composed with mixins. `_fullScreen` / `_width` / `_height` stay as accessors
 * because the state schema (`deriveSchema` mappings in `./index.ts`) reads and writes them.
 * Remove once VideoBroadcast is ported to Reader composition.
 */
export interface DisplayAPI extends DisplayApi {
  _fullScreen: boolean;
  _width: number;
  _height: number;
}

export const WithDisplay = <T extends ClassType<VideoBroadcastEnv>>(Base: T) =>
  class extends Base implements DisplayAPI {
    readonly _displayEnv: DisplayEnv = createDisplayEnv(
      this.env.videoWindow,
      {
        onFullScreenChange: (fullScreen) => () => this.env.eventHandlers.onFullScreenChange(fullScreen),
      },
      this.env.defaults.fullScreen,
    )();

    readonly setFullScreen = (fullScreen: boolean): void => setFullScreen(fullScreen)(this._displayEnv)();

    get fullScreen(): boolean {
      return isFullScreen(this._displayEnv)();
    }

    get width(): number {
      return getSize(this._displayEnv)().width;
    }

    set width(value: number) {
      setWidth(value)(this._displayEnv)();
    }

    get height(): number {
      return getSize(this._displayEnv)().height;
    }

    set height(value: number) {
      setHeight(value)(this._displayEnv)();
    }

    get _fullScreen(): boolean {
      return this.fullScreen;
    }

    set _fullScreen(fullScreen: boolean) {
      applyDisplayState({ fullScreen })(this._displayEnv)();
    }

    get _width(): number {
      return this.width;
    }

    set _width(width: number) {
      applyDisplayState({ width })(this._displayEnv)();
    }

    get _height(): number {
      return this.height;
    }

    set _height(height: number) {
      applyDisplayState({ height })(this._displayEnv)();
    }
  };
