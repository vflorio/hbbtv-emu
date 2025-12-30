import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";

const logger = createLogger("RemoteControl");

// HbbTV Key Codes
export const HbbTVKeyCodes = {
  // Navigation
  VK_UP: 38,
  VK_DOWN: 40,
  VK_LEFT: 37,
  VK_RIGHT: 39,
  VK_ENTER: 13,
  VK_BACK: 461,

  // Color keys
  VK_RED: 403,
  VK_GREEN: 404,
  VK_YELLOW: 405,
  VK_BLUE: 406,

  // Numeric keys
  VK_0: 48,
  VK_1: 49,
  VK_2: 50,
  VK_3: 51,
  VK_4: 52,
  VK_5: 53,
  VK_6: 54,
  VK_7: 55,
  VK_8: 56,
  VK_9: 57,

  // Media control
  VK_PLAY: 415,
  VK_PAUSE: 19,
  VK_STOP: 413,
  VK_FAST_FWD: 417,
  VK_REWIND: 412,

  // Volume
  VK_VOLUME_UP: 447,
  VK_VOLUME_DOWN: 448,

  // Channel
  VK_CHANNEL_UP: 427,
  VK_CHANNEL_DOWN: 428,
} as const;

export type HbbTVKeyCode = (typeof HbbTVKeyCodes)[keyof typeof HbbTVKeyCodes];

// Dependencies

/** Provides DOM event dispatching capabilities */
type EventDispatcher = Readonly<{
  dispatchKeyEvent: (keyCode: number) => IO.IO<void>;
}>;

export type RemoteControlEnv = EventDispatcher;

// Default implementation

export const defaultEventDispatcher: EventDispatcher = {
  dispatchKeyEvent: (keyCode) => () => {
    // Dispatch keydown event
    const keydownEvent = new KeyboardEvent("keydown", {
      keyCode,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(keydownEvent);

    // Dispatch keyup event
    const keyupEvent = new KeyboardEvent("keyup", {
      keyCode,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(keyupEvent);
  },
};

// Operations

export const dispatchRemoteKey =
  (keyCode: number): RIO.ReaderIO<RemoteControlEnv, void> =>
  (env) =>
    pipe(
      logger.debug("Dispatching remote key:", keyCode),
      IO.tap(() => env.dispatchKeyEvent(keyCode)),
      IO.tap(() => logger.debug("Remote key dispatched")),
    );

export const createRemoteControlEnv = (): RemoteControlEnv => ({
  ...defaultEventDispatcher,
});
