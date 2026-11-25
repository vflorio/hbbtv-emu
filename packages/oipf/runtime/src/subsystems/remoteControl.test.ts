import { afterEach, describe, expect, it } from "vitest";
import { createEventDispatcher, detectKeyTargetRule, keyName } from "./remoteControl";

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

describe("keyName", () => {
  it("names navigation, colour and digit keys", () => {
    expect([38, 13, 461, 406, 48, 57, 999].map(keyName)).toEqual([
      "ArrowUp",
      "Enter",
      "GoBack",
      "ColorF3Blue",
      "0",
      "9",
      "Unidentified",
    ]);
  });
});

describe("detectKeyTargetRule", () => {
  it("recognises Gecko by a feature, not by the user agent", () => {
    expect(detectKeyTargetRule({} as Window)).toBe("blink-webkit");
    expect(detectKeyTargetRule({ mozInnerScreenX: 0 } as unknown as Window)).toBe("gecko");
  });
});
