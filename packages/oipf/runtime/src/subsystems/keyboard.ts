/**
 * The computer's keyboard, as the TV's remote control.
 *
 * A TV delivers to the application only the keys of TS 102 796 §10.2.2.1 (Table 12),
 * and only those its keyset asks for; it handles the others itself (P+/P-, volume).
 * A real keyboard would give the application every key, so its events never reach
 * the page as they are: a key that stands for a remote key is pressed on the remote
 * instead (`dispatchRemoteKey`, which applies the keyset), the others are hidden from
 * the application.
 *
 * Except when a text field has the focus: it receives the keys whatever the keyset
 * (§10.2.2.1), so the keyboard types as a keyboard. Shortcuts with Ctrl, Alt or Meta
 * stay the browser's (reload, developer tools, …).
 */

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import { dispatchRemoteKey, HbbTVKeyCodes, keyGroup, type RemoteControlEnv } from "./remoteControl";

const logger = createLogger("Keyboard");

/** The remote key each keyboard key stands for, by `KeyboardEvent.key` (letters in lower case). */
export type KeyMap = Readonly<Record<string, number>>;

const DIGITS: KeyMap = Object.fromEntries(
  Array.from({ length: 10 }, (_, digit) => [String(digit), HbbTVKeyCodes.VK_0 + digit]),
);

/**
 * The emulator's choice (the spec says nothing about keyboards): the keys with the
 * same name, letters for the colour and VCR keys, and for the TV's own keys some that
 * do not type in a text field anyway (Page Up/Down) or that only do there (+/-).
 */
export const DEFAULT_KEY_MAP: KeyMap = {
  ArrowUp: HbbTVKeyCodes.VK_UP,
  ArrowDown: HbbTVKeyCodes.VK_DOWN,
  ArrowLeft: HbbTVKeyCodes.VK_LEFT,
  ArrowRight: HbbTVKeyCodes.VK_RIGHT,
  Enter: HbbTVKeyCodes.VK_ENTER,
  Backspace: HbbTVKeyCodes.VK_BACK,
  BrowserBack: HbbTVKeyCodes.VK_BACK,
  ...DIGITS,
  r: HbbTVKeyCodes.VK_RED,
  g: HbbTVKeyCodes.VK_GREEN,
  y: HbbTVKeyCodes.VK_YELLOW,
  b: HbbTVKeyCodes.VK_BLUE,
  p: HbbTVKeyCodes.VK_PLAY,
  " ": HbbTVKeyCodes.VK_PAUSE,
  s: HbbTVKeyCodes.VK_STOP,
  f: HbbTVKeyCodes.VK_FAST_FWD,
  w: HbbTVKeyCodes.VK_REWIND,
  MediaPlay: HbbTVKeyCodes.VK_PLAY,
  MediaPause: HbbTVKeyCodes.VK_PAUSE,
  MediaStop: HbbTVKeyCodes.VK_STOP,
  MediaFastForward: HbbTVKeyCodes.VK_FAST_FWD,
  MediaRewind: HbbTVKeyCodes.VK_REWIND,
  PageUp: HbbTVKeyCodes.VK_CHANNEL_UP,
  PageDown: HbbTVKeyCodes.VK_CHANNEL_DOWN,
  "+": HbbTVKeyCodes.VK_VOLUME_UP,
  "-": HbbTVKeyCodes.VK_VOLUME_DOWN,
};

/** `KeyboardEvent.key` from the legacy `keyCode`, for engines without `key` (Chromium < 51). */
const LEGACY_KEYS: Readonly<Record<number, string>> = {
  8: "Backspace",
  13: "Enter",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  107: "+",
  109: "-",
};

const legacyKey = (keyCode: number): string => {
  if (keyCode >= 48 && keyCode <= 57) return String(keyCode - 48);
  if (keyCode >= 96 && keyCode <= 105) return String(keyCode - 96);
  if (keyCode >= 65 && keyCode <= 90) return String.fromCharCode(keyCode + 32);
  return LEGACY_KEYS[keyCode] ?? "Unidentified";
};

/** The key as the map names it: `key` (letters in lower case), else from `keyCode`. */
export const keyOf = (event: KeyboardEvent): string => {
  const { key } = event;
  if (key === undefined || key === "" || key === "Unidentified") return legacyKey(event.keyCode);
  return key.length === 1 ? key.toLowerCase() : key;
};

/** The remote key a keyboard key stands for, if any. */
export const remoteKeyOf = (keyMap: KeyMap, event: KeyboardEvent): number | null => keyMap[keyOf(event)] ?? null;

/**
 * What becomes of a key from the keyboard:
 * - `remote`: pressed on the remote, the event itself cancelled;
 * - `hidden`: the application does not see it, the browser still acts on it (e.g. F5);
 * - `native`: it reaches the page as it is (a text field, a browser shortcut).
 */
export type KeyboardRoute = "remote" | "hidden" | "native";

export const routeOf = (keyMap: KeyMap, event: KeyboardEvent, textEntryFocused: boolean): KeyboardRoute => {
  if (textEntryFocused || event.ctrlKey || event.altKey || event.metaKey) return "native";
  return remoteKeyOf(keyMap, event) === null ? "hidden" : "remote";
};

export type KeyboardEnv = RemoteControlEnv &
  Readonly<{
    window: Window;
    keyMap: KeyMap;
    /** A key the TV keeps for itself (P+/P-, volume): the host acts on it. */
    pressTvKey: (keyCode: number) => IO.IO<void>;
    /** Whether an event comes from the keyboard, not from a script (the remote's own events, the application's). */
    fromKeyboard: (event: KeyboardEvent) => boolean;
  }>;

const pressed =
  (keyCode: number): RIO.ReaderIO<KeyboardEnv, void> =>
  (env) =>
    keyGroup(keyCode) === null ? env.pressTvKey(keyCode) : dispatchRemoteKey(keyCode)(env);

const KEY_TYPES = ["keydown", "keypress", "keyup"] as const;

/**
 * Listens to the keyboard before anything else in the page: on the window, in the
 * capture phase, installed before the application's first script. A key's keypress
 * and keyup follow what became of its keydown, even if the focus moved meanwhile.
 * A key held down repeats its keydown, and so is pressed again, as on a remote.
 * Returns the effect that removes the listeners.
 */
export const installKeyboard: RIO.ReaderIO<KeyboardEnv, IO.IO<void>> = (env) => () => {
  const routes = new Map<string, KeyboardRoute>();
  let lastRoute: KeyboardRoute = "native";
  const idOf = (event: KeyboardEvent) => event.code || String(event.keyCode);

  const onKey = (event: Event) => {
    const keyEvent = event as KeyboardEvent;
    if (!env.fromKeyboard(keyEvent)) return;

    let route: KeyboardRoute;
    if (keyEvent.type === "keydown") {
      route = routeOf(env.keyMap, keyEvent, env.textEntryFocused());
      routes.set(idOf(keyEvent), route);
      lastRoute = route;
    } else if (keyEvent.type === "keypress") {
      // Its keyCode is the character's: it belongs to the keydown just before it.
      route = lastRoute;
    } else {
      route = routes.get(idOf(keyEvent)) ?? "native";
      routes.delete(idOf(keyEvent));
    }
    if (route === "native") return;

    keyEvent.stopImmediatePropagation();
    if (route === "hidden") return;
    keyEvent.preventDefault();

    const keyCode = remoteKeyOf(env.keyMap, keyEvent);
    if (keyEvent.type === "keydown" && keyCode !== null) {
      pipe(
        logger.debug(`Keyboard "${keyOf(keyEvent)}" pressed as remote key ${keyCode}`),
        IO.flatMap(() => pressed(keyCode)(env)),
      )();
    }
  };

  for (const type of KEY_TYPES) env.window.addEventListener(type, onKey, true);
  return () => {
    for (const type of KEY_TYPES) env.window.removeEventListener(type, onKey, true);
  };
};

/** Without a host, nobody acts on the TV's own keys. */
export const ignoreTvKey = (keyCode: number): IO.IO<void> =>
  logger.info(`Key ${keyCode} is the TV's, and no host acts on it`);
