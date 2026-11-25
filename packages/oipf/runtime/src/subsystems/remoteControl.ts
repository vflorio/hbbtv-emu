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

/** `KeyboardEvent.key` values (UI Events, plus the colour keys of CEA-2014 / HbbTV). */
const KEY_NAMES: Readonly<Record<number, string>> = {
  38: "ArrowUp",
  40: "ArrowDown",
  37: "ArrowLeft",
  39: "ArrowRight",
  13: "Enter",
  461: "GoBack",
  403: "ColorF0Red",
  404: "ColorF1Green",
  405: "ColorF2Yellow",
  406: "ColorF3Blue",
  415: "MediaPlay",
  19: "MediaPause",
  413: "MediaStop",
  417: "MediaFastForward",
  412: "MediaRewind",
  447: "AudioVolumeUp",
  448: "AudioVolumeDown",
  427: "ChannelUp",
  428: "ChannelDown",
};

export const keyName = (keyCode: number): string =>
  KEY_NAMES[keyCode] ?? (keyCode >= 48 && keyCode <= 57 ? String(keyCode - 48) : "Unidentified");

/** Keys that also produce a character, hence a `keypress` (as a browser does for a real keyboard). */
const producesCharacter = (keyCode: number): boolean => keyCode === 13 || (keyCode >= 48 && keyCode <= 57);

/**
 * With nothing focused, where the engine delivers a real key: to the body only in
 * HTML documents, to the root element otherwise (Blink and WebKit: most HbbTV
 * applications are XHTML, so `<html>`); or to the body whenever there is one (Gecko).
 * Checked against Chromium and Firefox.
 */
export type KeyTargetRule = "blink-webkit" | "gecko";

/**
 * Gecko, detected by a feature only it has: the user agent cannot tell, since the
 * emulator overrides it.
 */
export const detectKeyTargetRule = (window: Window): KeyTargetRule =>
  "mozInnerScreenX" in window ? "gecko" : "blink-webkit";

/**
 * Where the browser delivers a real key: the focused element, else per the engine's
 * rule. Never the document itself: applications and their third-party scripts expect
 * `event.target` to be an Element.
 *
 * `activeElement` reports the body when nothing is focused, so the body counts as
 * "nothing focused" (a body made focusable and focused is the only case this misses).
 */
export const keyTarget = (document: Document, rule: KeyTargetRule = "blink-webkit"): Element | null => {
  const active = document.activeElement;
  if (active && active !== document.body && active !== document.documentElement) return active;
  const bodyFirst = rule === "gecko" || document.contentType === "text/html";
  if (bodyFirst && document.body) return document.body;
  return document.documentElement;
};

/**
 * `keyCode`, `charCode` and `which` are legacy: some engines ignore them in the init
 * dictionary (older Chromium, which matters here), so they are forced on the instance.
 */
const keyboardEvent = (type: "keydown" | "keypress" | "keyup", keyCode: number, charCode = 0): KeyboardEvent => {
  const event = new KeyboardEvent(type, {
    key: keyName(keyCode),
    keyCode,
    charCode,
    which: charCode || keyCode,
    bubbles: true,
    cancelable: true,
  } as KeyboardEventInit);
  const legacy = { keyCode: type === "keypress" ? charCode : keyCode, charCode, which: charCode || keyCode };
  for (const [name, value] of Object.entries(legacy)) {
    if ((event as unknown as Record<string, number>)[name] !== value) {
      Object.defineProperty(event, name, { get: () => value });
    }
  }
  return event;
};

/** keydown, keypress (only for character keys, and only if keydown was not cancelled), keyup. */
export const createEventDispatcher = (
  document: Document,
  rule: KeyTargetRule = document.defaultView ? detectKeyTargetRule(document.defaultView) : "blink-webkit",
): EventDispatcher => ({
  dispatchKeyEvent: (keyCode) => () => {
    const target = keyTarget(document, rule);
    if (!target) return;

    const proceed = target.dispatchEvent(keyboardEvent("keydown", keyCode));
    if (proceed && producesCharacter(keyCode)) {
      target.dispatchEvent(keyboardEvent("keypress", keyCode, keyCode));
    }
    // keyup goes wherever the focus is now (a keydown handler may have moved it).
    (keyTarget(document, rule) ?? target).dispatchEvent(keyboardEvent("keyup", keyCode));
  },
});

export const defaultEventDispatcher: EventDispatcher = {
  dispatchKeyEvent: (keyCode) => createEventDispatcher(document).dispatchKeyEvent(keyCode),
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
