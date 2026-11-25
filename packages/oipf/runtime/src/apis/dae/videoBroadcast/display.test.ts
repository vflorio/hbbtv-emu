import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import {
  applyDisplayState,
  createDisplayEnv,
  displayApi,
  parseDimension,
  readDisplayState,
  type Size,
  setFullScreen,
  setHeight,
  setWidth,
  type VideoWindow,
} from "./display";

type Call =
  | { readonly width: number }
  | { readonly height: number }
  | { readonly fullScreen: boolean }
  | { readonly event: boolean };

/** A window whose size behaves like an element's style: it changes only when written. */
const setup = (initial: { fullScreen?: boolean; size?: Size } = {}) => {
  const calls: Call[] = [];
  let size: Size = initial.size ?? { width: 1280, height: 720 };
  const videoWindow: VideoWindow = {
    getSize: () => size,
    setWidth: (width) => () => {
      size = { ...size, width };
      calls.push({ width });
    },
    setHeight: (height) => () => {
      size = { ...size, height };
      calls.push({ height });
    },
    setFullScreen: (fullScreen) => () => {
      calls.push({ fullScreen });
    },
  };
  const env = createDisplayEnv(
    videoWindow,
    {
      onFullScreenChange: (fullScreen) => () => {
        calls.push({ event: fullScreen });
      },
    },
    initial.fullScreen ?? false,
  )();
  return {
    env,
    calls,
    state: () => readDisplayState(env)(),
    /** Simulates something else (application CSS) changing the object's size. */
    resizeExternally: (next: Size) => {
      size = next;
    },
  };
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

describe("readDisplayState", () => {
  it("combines the full-screen flag with the live window size", () => {
    const { state, resizeExternally } = setup();

    resizeExternally({ width: 320, height: 180 });

    expect(state()).toEqual({ fullScreen: false, width: 320, height: 180 });
  });
});

describe("setFullScreen", () => {
  it("enters full-screen: updates state, the window, then notifies the application", () => {
    const { env, calls, state } = setup();

    setFullScreen(true)(env)();

    expect(state().fullScreen).toBe(true);
    expect(calls).toEqual([{ fullScreen: true }, { event: true }]);
  });

  it("leaves full-screen without touching the window size", () => {
    const { env, calls, state } = setup({ fullScreen: true, size: { width: 640, height: 360 } });

    setFullScreen(false)(env)();

    expect(state()).toEqual({ fullScreen: false, width: 640, height: 360 });
    expect(calls).toEqual([{ fullScreen: false }, { event: false }]);
  });

  it("does nothing, and fires no event, when the mode does not change", () => {
    const { env, calls } = setup();

    setFullScreen(false)(env)();

    expect(calls).toEqual([]);
  });
});

describe("width / height written by the application", () => {
  it("writes only the dimension that changes", () => {
    const { env, calls, state } = setup();

    setWidth(640)(env)();
    setHeight(360)(env)();

    expect(state()).toMatchObject({ width: 640, height: 360 });
    expect(calls).toEqual([{ width: 640 }, { height: 360 }]);
  });

  it("is ignored while in full-screen", () => {
    const { env, calls, state } = setup({ fullScreen: true });

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

  it("may resize the window while in full-screen", () => {
    const { env, calls, state } = setup({ fullScreen: true });

    applyDisplayState({ width: 640, height: 360 })(env)();

    expect(state()).toEqual({ fullScreen: true, width: 640, height: 360 });
    expect(calls).toEqual([{ width: 640 }, { height: 360 }]);
  });

  it("applies size and mode from a single patch", () => {
    const { env, state } = setup({ fullScreen: true });

    applyDisplayState({ fullScreen: false, width: 640, height: 360 })(env)();

    expect(state()).toEqual({ fullScreen: false, width: 640, height: 360 });
  });

  it("ignores invalid and unchanged sizes, and does nothing on an empty patch", () => {
    const { env, calls } = setup();

    applyDisplayState({ width: -1, height: 720 })(env)();
    applyDisplayState({})(env)();

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
