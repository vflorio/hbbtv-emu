import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import {
  applyDisplayState,
  createDisplayEnv,
  type DisplayState,
  displayApi,
  parseDimension,
  readDisplayState,
  setFullScreen,
  setHeight,
  setWidth,
} from "./display";

type Call =
  | { readonly resize: readonly [number, number] }
  | { readonly fullScreen: boolean }
  | { readonly event: boolean };

const WINDOWED: DisplayState = { fullScreen: false, width: 1280, height: 720 };

const setup = (initial: DisplayState = WINDOWED) => {
  const calls: Call[] = [];
  const env = createDisplayEnv(
    {
      resize: (width, height) => () => {
        calls.push({ resize: [width, height] });
      },
      setFullScreen: (fullScreen) => () => {
        calls.push({ fullScreen });
      },
    },
    {
      onFullScreenChange: (fullScreen) => () => {
        calls.push({ event: fullScreen });
      },
    },
    initial,
  )();
  return { env, calls, state: () => readDisplayState(env)() };
};

describe("parseDimension", () => {
  it.each([0, 1, 640, 1920])("accepts %d", (value) => {
    expect(parseDimension(value)).toEqual(O.some(value));
  });

  it("truncates non-integer values", () => {
    expect(parseDimension(640.7)).toEqual(O.some(640));
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, "640", null])("rejects %s", (value) => {
    expect(parseDimension(value)).toEqual(O.none);
  });
});

describe("setFullScreen", () => {
  it("enters full-screen: updates state, the window, then notifies the application", () => {
    const { env, calls, state } = setup();

    setFullScreen(true)(env)();

    expect(state().fullScreen).toBe(true);
    expect(calls).toEqual([{ fullScreen: true }, { event: true }]);
  });

  it("leaving full-screen restores the windowed size before notifying", () => {
    const { env, calls } = setup({ fullScreen: true, width: 640, height: 360 });

    setFullScreen(false)(env)();

    expect(calls).toEqual([{ fullScreen: false }, { resize: [640, 360] }, { event: false }]);
  });

  it("does nothing, and fires no event, when the mode does not change", () => {
    const { env, calls } = setup();

    setFullScreen(false)(env)();

    expect(calls).toEqual([]);
  });
});

describe("width / height written by the application", () => {
  it("resizes the window while windowed", () => {
    const { env, calls, state } = setup();

    setWidth(640)(env)();
    setHeight(360)(env)();

    expect(state()).toMatchObject({ width: 640, height: 360 });
    expect(calls).toEqual([{ resize: [640, 720] }, { resize: [640, 360] }]);
  });

  it("is ignored while in full-screen", () => {
    const { env, calls, state } = setup({ fullScreen: true, width: 1280, height: 720 });

    setWidth(640)(env)();
    setHeight(360)(env)();

    expect(state()).toMatchObject({ width: 1280, height: 720 });
    expect(calls).toEqual([]);
  });

  it("ignores invalid and unchanged values", () => {
    const { env, calls } = setup();

    setWidth(-10)(env)();
    setWidth(Number.NaN)(env)();
    setHeight(720)(env)();

    expect(calls).toEqual([]);
  });
});

describe("applyDisplayState (settings UI)", () => {
  it("drives full-screen and fires the application event", () => {
    const { env, calls, state } = setup();

    applyDisplayState({ fullScreen: true })(env)();

    expect(state().fullScreen).toBe(true);
    expect(calls).toEqual([{ fullScreen: true }, { event: true }]);
  });

  it("may change the windowed size while in full-screen; it is applied on exit", () => {
    const { env, calls, state } = setup({ fullScreen: true, width: 1280, height: 720 });

    applyDisplayState({ width: 640, height: 360 })(env)();
    expect(state()).toMatchObject({ fullScreen: true, width: 640, height: 360 });
    expect(calls).toEqual([]);

    applyDisplayState({ fullScreen: false })(env)();
    expect(calls).toEqual([{ fullScreen: false }, { resize: [640, 360] }, { event: false }]);
  });

  it("leaving full-screen and resizing in one patch ends windowed at the new size", () => {
    const { env, calls, state } = setup({ fullScreen: true, width: 1280, height: 720 });

    applyDisplayState({ fullScreen: false, width: 640, height: 360 })(env)();

    expect(state()).toEqual({ fullScreen: false, width: 640, height: 360 });
    expect(calls[calls.length - 1]).toEqual({ resize: [640, 360] });
  });

  it("resizing and entering full-screen in one patch keeps the new windowed size", () => {
    const { env, state } = setup();

    applyDisplayState({ fullScreen: true, width: 640, height: 360 })(env)();

    expect(state()).toEqual({ fullScreen: true, width: 640, height: 360 });
  });

  it("ignores invalid sizes and does nothing on an empty patch", () => {
    const { env, calls, state } = setup();

    applyDisplayState({ width: -1 })(env)();
    applyDisplayState({})(env)();

    expect(state()).toEqual(WINDOWED);
    expect(calls).toEqual([]);
  });
});

describe("displayApi", () => {
  it("exposes the OIPF properties backed by the env", () => {
    const { env } = setup();
    const api = displayApi(env);

    api.width = 640;
    api.setFullScreen(true);
    api.height = 100;

    expect(api.width).toBe(640);
    expect(api.height).toBe(720);
    expect(api.fullScreen).toBe(true);
  });
});
