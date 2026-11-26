import { OIPF } from "@hbb-emu/oipf-api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_KEY_MAP, installKeyboard, keyOf, routeOf } from "./keyboard";
import { createEventDispatcher } from "./remoteControl";

const { RED, NAVIGATION } = OIPF.DAE.ApplicationManager.KeysetMask;

/** Events "from the keyboard": a real one is trusted, which a test cannot forge. */
const fromKeyboard = new WeakSet<Event>();

type Seen = Readonly<{ type: string; keyCode: number; fromKeyboard: boolean }>;

let keysetValue = 0;
let tvKeys: number[] = [];
let seen: Seen[] = [];
let uninstall = () => {};

const appListener = (event: Event) => {
  const key = event as KeyboardEvent;
  seen.push({ type: key.type, keyCode: key.keyCode, fromKeyboard: fromKeyboard.has(key) });
};

beforeEach(() => {
  keysetValue = 0;
  tvKeys = [];
  seen = [];
  const dispatcher = createEventDispatcher(document);
  uninstall = installKeyboard({
    ...dispatcher,
    keysetValue: () => keysetValue,
    window,
    keyMap: DEFAULT_KEY_MAP,
    pressTvKey: (keyCode) => () => void tvKeys.push(keyCode),
    fromKeyboard: (event) => fromKeyboard.has(event),
  })();
  // The application's listeners, added after the runtime's (its scripts run later).
  for (const type of ["keydown", "keypress", "keyup"]) {
    window.addEventListener(type, appListener, true);
    document.addEventListener(type, appListener);
  }
});

afterEach(() => {
  uninstall();
  for (const type of ["keydown", "keypress", "keyup"]) {
    window.removeEventListener(type, appListener, true);
    document.removeEventListener(type, appListener);
  }
  document.body.innerHTML = "";
});

/** A key event from the keyboard, where the browser sends it: the focused element. */
const keyboard = (type: string, key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...init });
  fromKeyboard.add(event);
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
};

/** keydown and keyup; the keydown's event is returned. */
const tap = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const down = keyboard("keydown", key, init);
  keyboard("keyup", key, init);
  return down;
};

const keydowns = () => seen.filter((event) => event.type === "keydown");

describe("the keyboard as the remote", () => {
  it("presses the remote key a keyboard key stands for, which the application gets if its keyset asks for it", () => {
    keysetValue = RED;

    const down = tap("r");
    tap("ArrowUp");

    // Twice per key: the application listens on the window and on the document.
    expect(keydowns()).toEqual([
      { type: "keydown", keyCode: 403, fromKeyboard: false },
      { type: "keydown", keyCode: 403, fromKeyboard: false },
    ]);
    expect(seen.some((event) => event.fromKeyboard)).toBe(false);
    expect(down.defaultPrevented).toBe(true);
  });

  it("hides from the application the keys a remote does not have, leaving them to the browser", () => {
    keysetValue = RED | NAVIGATION;

    const down = tap("a");
    tap("F5");

    expect(seen).toEqual([]);
    expect(down.defaultPrevented).toBe(false);
  });

  it("gives the TV its own keys (P+/P-, volume), never the application", () => {
    keysetValue = 0x13f;

    tap("PageUp");
    tap("PageDown");
    tap("+");
    tap("-");

    expect(tvKeys).toEqual([427, 428, 447, 448]);
    expect(seen).toEqual([]);
  });

  it("types into a focused text field, whatever the keyset (TS 102 796 §10.2.2.1)", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    tap("r");

    expect(keydowns()).toEqual([
      { type: "keydown", keyCode: 0, fromKeyboard: true },
      { type: "keydown", keyCode: 0, fromKeyboard: true },
    ]);
  });

  it("leaves the browser's shortcuts to the browser", () => {
    const down = tap("r", { ctrlKey: true });

    expect(down.defaultPrevented).toBe(false);
    expect(keydowns().every((event) => event.fromKeyboard)).toBe(true);
  });

  it("reads upper-case letters as their key", () => {
    keysetValue = RED;

    tap("R", { shiftKey: true });

    expect(keydowns().map((event) => event.keyCode)).toEqual([403, 403]);
  });

  it("keeps a key's keyup with its keydown, even when the application moved the focus to a text field", () => {
    keysetValue = NAVIGATION;
    const input = document.createElement("input");
    document.body.appendChild(input);
    const focusOnEnter = (event: KeyboardEvent) => {
      if (event.keyCode === 13) input.focus();
    };
    document.addEventListener("keydown", focusOnEnter);

    try {
      tap("Enter", { code: "Enter" });
    } finally {
      document.removeEventListener("keydown", focusOnEnter);
    }

    expect(seen.filter((event) => event.fromKeyboard)).toEqual([]);
  });

  it("stops once uninstalled", () => {
    uninstall();

    tap("a");

    expect(keydowns()).toEqual([
      { type: "keydown", keyCode: 0, fromKeyboard: true },
      { type: "keydown", keyCode: 0, fromKeyboard: true },
    ]);
  });
});

describe("keyOf", () => {
  it("lower-cases letters and keeps named keys", () => {
    expect(["R", "r", "ArrowUp", " ", "+"].map((key) => keyOf(new KeyboardEvent("keydown", { key })))).toEqual([
      "r",
      "r",
      "ArrowUp",
      " ",
      "+",
    ]);
  });

  it("falls back to the legacy keyCode on engines without `key`", () => {
    const legacy = (keyCode: number) => keyOf({ key: undefined, keyCode } as unknown as KeyboardEvent);

    expect([82, 49, 97, 38, 8, 33, 107, 999].map(legacy)).toEqual([
      "r",
      "1",
      "1",
      "ArrowUp",
      "Backspace",
      "PageUp",
      "+",
      "Unidentified",
    ]);
  });
});

describe("routeOf", () => {
  const event = (key: string, init: KeyboardEventInit = {}) => new KeyboardEvent("keydown", { key, ...init });

  it.each<[string, KeyboardEventInit, boolean, string]>([
    ["r", {}, false, "remote"],
    ["a", {}, false, "hidden"],
    ["r", {}, true, "native"],
    ["r", { altKey: true }, false, "native"],
    ["r", { metaKey: true }, false, "native"],
  ])("%s %j, text field focused: %s → %s", (key, init, textEntryFocused, expected) => {
    expect(routeOf(DEFAULT_KEY_MAP, event(key, init), textEntryFocused)).toBe(expected);
  });
});
