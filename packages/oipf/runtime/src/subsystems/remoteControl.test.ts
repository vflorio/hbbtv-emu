import { afterEach, describe, expect, it } from "vitest";
import {
  createEventDispatcher,
  detectKeyTargetRule,
  dispatchRemoteKey,
  isDelivered,
  isTextEntry,
  keyGroup,
  keyName,
  type RemoteControlEnv,
} from "./remoteControl";

type Seen = { type: string; target: string; key: string; keyCode: number; which: number; charCode: number };

const record = () => {
  const seen: Seen[] = [];
  const listener = (event: Event) => {
    const e = event as KeyboardEvent;
    const target = e.target as Element;
    seen.push({
      type: e.type,
      // A third-party script crashed with "target.getAttribute is not a function".
      target: `${target.tagName.toLowerCase()}${target.getAttribute("id") ? `#${target.getAttribute("id")}` : ""}`,
      key: e.key,
      keyCode: e.keyCode,
      which: e.which,
      charCode: e.charCode,
    });
  };
  for (const type of ["keydown", "keypress", "keyup"]) document.addEventListener(type, listener);
  return {
    seen,
    stop: () => {
      for (const type of ["keydown", "keypress", "keyup"]) document.removeEventListener(type, listener);
    },
  };
};

const press = (keyCode: number) => createEventDispatcher(document).dispatchKeyEvent(keyCode)();

let stop = () => {};
afterEach(() => {
  stop();
  document.body.innerHTML = "";
});

describe("remote control key events", () => {
  it("are delivered to the body when nothing is focused, never to the document", () => {
    const recorder = record();
    stop = recorder.stop;

    press(403);

    expect(recorder.seen.map((s) => [s.type, s.target])).toEqual([
      ["keydown", "body"],
      ["keyup", "body"],
    ]);
  });

  it("in an XHTML document with nothing focused, Blink and WebKit deliver them to the root element (as Chromium does)", () => {
    const xhtml = new DOMParser().parseFromString(
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>app</title></head><body></body></html>',
      "application/xhtml+xml",
    );
    const targets: string[] = [];
    xhtml.addEventListener("keydown", (event) => targets.push((event.target as Element).localName));

    createEventDispatcher(xhtml, "blink-webkit").dispatchKeyEvent(403)();

    expect(targets).toEqual(["html"]);
  });

  it("in an XHTML document with nothing focused, Gecko delivers them to the body (as Firefox does)", () => {
    const xhtml = new DOMParser().parseFromString(
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>app</title></head><body></body></html>',
      "application/xhtml+xml",
    );
    const targets: string[] = [];
    xhtml.addEventListener("keydown", (event) => targets.push((event.target as Element).localName));

    createEventDispatcher(xhtml, "gecko").dispatchKeyEvent(403)();

    expect(targets).toEqual(["body"]);
  });

  it("are delivered to the focused element", () => {
    document.body.innerHTML = '<a id="menu" href="#">menu</a>';
    (document.getElementById("menu") as HTMLElement).focus();
    const recorder = record();
    stop = recorder.stop;

    press(38);

    expect(recorder.seen.map((s) => s.target)).toEqual(["a#menu", "a#menu"]);
  });

  it("carry key, keyCode and which like a real keyboard", () => {
    const recorder = record();
    stop = recorder.stop;

    press(403);

    expect(recorder.seen[0]).toMatchObject({ key: "ColorF0Red", keyCode: 403, which: 403, charCode: 0 });
  });

  it("OK (Enter) and digits also produce a keypress with the character code", () => {
    const recorder = record();
    stop = recorder.stop;

    press(13);

    expect(recorder.seen.map((s) => s.type)).toEqual(["keydown", "keypress", "keyup"]);
    expect(recorder.seen[1]).toMatchObject({ key: "Enter", keyCode: 13, charCode: 13, which: 13 });
  });

  it("no keypress when the application cancels the keydown", () => {
    const cancel = (event: Event) => event.preventDefault();
    document.addEventListener("keydown", cancel);
    const recorder = record();
    stop = () => {
      recorder.stop();
      document.removeEventListener("keydown", cancel);
    };

    press(13);

    expect(recorder.seen.map((s) => s.type)).toEqual(["keydown", "keyup"]);
  });
});

describe("keyGroup", () => {
  it("is the Keyset constant of each key (OIPF DAE §7.2.5.1)", () => {
    expect([403, 404, 405, 406].map(keyGroup)).toEqual([0x1, 0x2, 0x4, 0x8]);
    expect([37, 38, 39, 40, 13, 461].map(keyGroup)).toEqual(Array(6).fill(0x10));
    expect([415, 19, 413, 417, 412].map(keyGroup)).toEqual(Array(5).fill(0x20));
    expect([48, 53, 57].map(keyGroup)).toEqual([0x100, 0x100, 0x100]);
  });

  it("is null for the keys the TV keeps: P+/P-, volume, anything else", () => {
    expect([427, 428, 447, 448, 999].map(keyGroup)).toEqual([null, null, null, null, null]);
  });
});

describe("isDelivered", () => {
  const NAVIGATION = 0x10;

  it("a key in the application's keyset", () => {
    expect(isDelivered(38, NAVIGATION, false)).toBe(true);
    expect(isDelivered(403, NAVIGATION, false)).toBe(false);
    expect(isDelivered(403, 0, false)).toBe(false);
  });

  it("any available key to a focused text field, whatever the keyset", () => {
    expect(isDelivered(49, 0, true)).toBe(true);
    expect(isDelivered(447, 0, true)).toBe(false);
  });
});

describe("isTextEntry", () => {
  it("textareas and inputs that accept text, not other controls", () => {
    document.body.innerHTML =
      '<textarea></textarea><input><input type="search"><input type="checkbox"><button></button>';
    const [textarea, input, search, checkbox, button] = Array.from(document.body.children);

    expect([textarea, input, search, checkbox, button, null].map((e) => isTextEntry(e ?? null))).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});

describe("dispatchRemoteKey", () => {
  const env = (keysetValue: number, textEntryFocused = false) => {
    const dispatched: number[] = [];
    const remote: RemoteControlEnv = {
      dispatchKeyEvent: (keyCode) => () => void dispatched.push(keyCode),
      textEntryFocused: () => textEntryFocused,
      keysetValue: () => keysetValue,
      keyReceived: () => void dispatched.push(-1),
    };
    return { remote, dispatched: () => dispatched.filter((keyCode) => keyCode !== -1), log: dispatched };
  };

  it("dispatches only the keys the application receives", () => {
    const { remote, dispatched } = env(0x1 | 0x10);

    for (const key of [403, 404, 38, 49, 427]) dispatchRemoteKey(key)(remote)();

    expect(dispatched()).toEqual([403, 38]);
  });

  it("reads the keyset at every key: a setValue() applies to the next one", () => {
    let value = 0;
    const dispatched: number[] = [];
    const remote: RemoteControlEnv = {
      dispatchKeyEvent: (keyCode) => () => void dispatched.push(keyCode),
      textEntryFocused: () => false,
      keysetValue: () => value,
      keyReceived: () => {},
    };

    dispatchRemoteKey(403)(remote)();
    value = 0x1;
    dispatchRemoteKey(403)(remote)();

    expect(dispatched).toEqual([403]);
  });

  it("a focused text field receives the digits even outside the keyset", () => {
    const { remote, dispatched } = env(0, true);

    dispatchRemoteKey(49)(remote)();

    expect(dispatched()).toEqual([49]);
  });

  it("tells that the application receives a key before its handlers run, and only then", () => {
    const { remote, log } = env(0x1);

    dispatchRemoteKey(404)(remote)();
    dispatchRemoteKey(403)(remote)();

    expect(log).toEqual([-1, 403]);
  });
});

describe("keyName", () => {
  it("names navigation, colour and digit keys", () => {
    expect([38, 13, 461, 406, 48, 57, 999].map(keyName)).toEqual([
      "ArrowUp",
      "Enter",
      "BrowserBack",
      "ColorF3Blue",
      "0",
      "9",
      "Unidentified",
    ]);
  });

  it("gives the events the `code` of TS 102 796 Table 12", () => {
    const codes: string[] = [];
    const listener = (event: KeyboardEvent) => codes.push(event.code);
    document.addEventListener("keydown", listener);
    try {
      for (const keyCode of [403, 461, 48, 57, 13, 415]) press(keyCode);
    } finally {
      document.removeEventListener("keydown", listener);
    }

    expect(codes).toEqual(["ColorF0Red", "BrowserBack", "Digit0", "Digit9", "Enter", "MediaPlay"]);
  });
});

describe("detectKeyTargetRule", () => {
  it("recognises Gecko by a feature, not by the user agent", () => {
    expect(detectKeyTargetRule({} as Window)).toBe("blink-webkit");
    expect(detectKeyTargetRule({ mozInnerScreenX: 0 } as unknown as Window)).toBe("gecko");
  });
});
