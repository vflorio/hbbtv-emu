/**
 * video/broadcast — display
 *
 * OIPF DAE `width`, `height`, `fullScreen`, `setFullScreen()` and `onFullScreenChange`.
 *
 * Reader-style module (ROADMAP D1), same shape as `./volume.ts`:
 * - state lives in an injected `IORef` and is the source of truth;
 * - `VideoWindow` is where the video is actually rendered (write-only port);
 * - `DisplayEvents` notifies the application.
 *
 * Rules:
 * - `width` / `height` are writable by the application only while not in full-screen;
 * - leaving full-screen restores the windowed size;
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

export type DisplayState = Readonly<{
  fullScreen: boolean;
  /** Windowed size in pixels, kept while in full-screen. */
  width: number;
  height: number;
}>;

/** Where the video is rendered. */
export type VideoWindow = Readonly<{
  resize: (width: number, height: number) => IO.IO<void>;
  setFullScreen: (fullScreen: boolean) => IO.IO<void>;
}>;

export type DisplayEvents = Readonly<{
  onFullScreenChange: (fullScreen: boolean) => IO.IO<void>;
}>;

export type DisplayEnv = Readonly<{
  displayState: IORef<DisplayState>;
  videoWindow: VideoWindow;
  displayEvents: DisplayEvents;
}>;

export const createDisplayEnv = (
  videoWindow: VideoWindow,
  displayEvents: DisplayEvents,
  initial: DisplayState,
): IO.IO<DisplayEnv> =>
  pipe(
    newIORef(initial),
    IO.map((displayState) => ({ displayState, videoWindow, displayEvents })),
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

export const readDisplayState: RIO.ReaderIO<DisplayEnv, DisplayState> = ({ displayState }) => displayState.read;

const noop: RIO.ReaderIO<DisplayEnv, void> = RIO.of(undefined);

/** Stores the windowed size; the window is resized only when not in full-screen. */
const writeSize =
  (width: number, height: number): RIO.ReaderIO<DisplayEnv, void> =>
  ({ displayState, videoWindow }) =>
    pipe(
      displayState.modify((state) => ({ ...state, width, height })),
      IO.flatMap(() => displayState.read),
      IO.flatMap((state) => (state.fullScreen ? IO.of(undefined) : videoWindow.resize(width, height))),
    );

const writeFullScreen =
  (fullScreen: boolean): RIO.ReaderIO<DisplayEnv, void> =>
  ({ displayState, videoWindow, displayEvents }) =>
    pipe(
      displayState.modify((state) => ({ ...state, fullScreen })),
      IO.flatMap(() => videoWindow.setFullScreen(fullScreen)),
      IO.flatMap(() => displayState.read),
      IO.flatMap((state) => (fullScreen ? IO.of(undefined) : videoWindow.resize(state.width, state.height))),
      IO.flatMap(() => displayEvents.onFullScreenChange(fullScreen)),
    );

/** `setFullScreen(fullScreen)`: no-op if the mode does not change. */
export const setFullScreen = (fullScreen: boolean): RIO.ReaderIO<DisplayEnv, void> =>
  pipe(
    readDisplayState,
    RIO.flatMap((state) => (state.fullScreen === Boolean(fullScreen) ? noop : writeFullScreen(Boolean(fullScreen)))),
  );

/**
 * Application write to `width` / `height`: ignored while in full-screen,
 * for invalid values and when nothing changes.
 */
const setDimension =
  (key: "width" | "height") =>
  (input: number): RIO.ReaderIO<DisplayEnv, void> =>
    pipe(
      readDisplayState,
      RIO.flatMap((state) =>
        pipe(
          parseDimension(input),
          O.filter(() => !state.fullScreen),
          O.filter((value) => value !== state[key]),
          O.match(
            () => noop,
            (value) => (key === "width" ? writeSize(value, state.height) : writeSize(state.width, value)),
          ),
        ),
      ),
    );

export const setWidth = setDimension("width");
export const setHeight = setDimension("height");

/**
 * Applies external state (settings UI, scenario).
 * Unlike the application, external state may update the windowed size while in
 * full-screen: it is stored and used when leaving full-screen.
 * Leaving full-screen happens before resizing, entering it after.
 */
export const applyDisplayState = (patch: Partial<DisplayState>): RIO.ReaderIO<DisplayEnv, void> => {
  const applySize: RIO.ReaderIO<DisplayEnv, void> = pipe(
    readDisplayState,
    RIO.flatMap((state) => {
      const width = pipe(
        O.fromNullable(patch.width),
        O.flatMap(parseDimension),
        O.getOrElse(() => state.width),
      );
      const height = pipe(
        O.fromNullable(patch.height),
        O.flatMap(parseDimension),
        O.getOrElse(() => state.height),
      );
      return width === state.width && height === state.height ? noop : writeSize(width, height);
    }),
  );

  const applyFullScreen: RIO.ReaderIO<DisplayEnv, void> =
    patch.fullScreen === undefined ? noop : setFullScreen(patch.fullScreen);

  return patch.fullScreen === false
    ? pipe(
        applyFullScreen,
        RIO.flatMap(() => applySize),
      )
    : pipe(
        applySize,
        RIO.flatMap(() => applyFullScreen),
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
    return readDisplayState(env)().fullScreen;
  },
  get width() {
    return readDisplayState(env)().width;
  },
  set width(value: number) {
    setWidth(value)(env)();
  },
  get height() {
    return readDisplayState(env)().height;
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
      {
        resize: (width, height) => this.env.setSize(width, height),
        setFullScreen: (fullScreen) => this.env.setFullscreen(fullScreen),
      },
      {
        onFullScreenChange: (fullScreen) => () => this.env.eventHandlers.onFullScreenChange(fullScreen),
      },
      {
        fullScreen: this.env.defaults.fullScreen,
        width: this.env.defaults.width,
        height: this.env.defaults.height,
      },
    )();

    readonly setFullScreen = (fullScreen: boolean): void => setFullScreen(fullScreen)(this._displayEnv)();

    get fullScreen(): boolean {
      return readDisplayState(this._displayEnv)().fullScreen;
    }

    get width(): number {
      return readDisplayState(this._displayEnv)().width;
    }

    set width(value: number) {
      setWidth(value)(this._displayEnv)();
    }

    get height(): number {
      return readDisplayState(this._displayEnv)().height;
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
