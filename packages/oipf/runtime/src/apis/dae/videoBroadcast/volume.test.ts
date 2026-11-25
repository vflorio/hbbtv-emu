import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import {
  type AudioOutput,
  applyVolumeState,
  createVolumeEnv,
  DEFAULT_VOLUME_STATE,
  getVolume,
  parseVolume,
  readVolumeState,
  setVolume,
  type VolumeState,
  volumeApi,
} from "./volume";

type OutputCall = { readonly volume: number } | { readonly muted: boolean };

const setup = (initial: VolumeState = DEFAULT_VOLUME_STATE) => {
  const output: OutputCall[] = [];
  const audioOutput: AudioOutput = {
    setVolume: (volume) => () => {
      output.push({ volume });
    },
    setMuted: (muted) => () => {
      output.push({ muted });
    },
  };
  const env = createVolumeEnv(audioOutput, initial)();
  return { env, output };
};

describe("parseVolume", () => {
  it.each([0, 1, 50, 100])("accepts %d", (value) => {
    expect(parseVolume(value)).toEqual(O.some(value));
  });

  it("truncates non-integer values, like a WebIDL integer argument", () => {
    expect(parseVolume(42.9)).toEqual(O.some(42));
    expect(parseVolume(99.99)).toEqual(O.some(99));
  });

  it.each([-1, 101, 1000, Number.NaN, Number.POSITIVE_INFINITY, "50", null, undefined])("rejects %s", (value) => {
    expect(parseVolume(value)).toEqual(O.none);
  });
});

describe("setVolume", () => {
  it("changes the volume, forwards it to the audio output and returns true", () => {
    const { env, output } = setup();

    expect(setVolume(30)(env)()).toBe(true);
    expect(getVolume(env)()).toBe(30);
    expect(output).toEqual([{ volume: 30 }]);
  });

  it("is visible to getVolume() immediately, without waiting for the player", () => {
    const { env } = setup();
    const api = volumeApi(env);

    api.setVolume(15);

    expect(api.getVolume()).toBe(15);
  });

  it("returns false and changes nothing when the value is out of range", () => {
    const { env, output } = setup();

    expect(setVolume(150)(env)()).toBe(false);
    expect(setVolume(-5)(env)()).toBe(false);
    expect(getVolume(env)()).toBe(100);
    expect(output).toEqual([]);
  });

  it("returns false when the volume is already at that level", () => {
    const { env, output } = setup({ volume: 40, muted: false });

    expect(setVolume(40)(env)()).toBe(false);
    expect(output).toEqual([]);
  });

  it("does not touch the muted flag", () => {
    const { env } = setup({ volume: 40, muted: true });

    setVolume(70)(env)();

    expect(readVolumeState(env)()).toEqual({ volume: 70, muted: true });
  });
});

describe("applyVolumeState", () => {
  it("applies volume and muted from external state", () => {
    const { env, output } = setup();

    applyVolumeState({ volume: 20, muted: true })(env)();

    expect(readVolumeState(env)()).toEqual({ volume: 20, muted: true });
    expect(output).toEqual([{ volume: 20 }, { muted: true }]);
  });

  it("only forwards the fields that change", () => {
    const { env, output } = setup({ volume: 20, muted: false });

    applyVolumeState({ volume: 20, muted: true })(env)();

    expect(output).toEqual([{ muted: true }]);
  });

  it("ignores an invalid volume but still applies muted", () => {
    const { env, output } = setup();

    applyVolumeState({ volume: 300, muted: true })(env)();

    expect(readVolumeState(env)()).toEqual({ volume: 100, muted: true });
    expect(output).toEqual([{ muted: true }]);
  });

  it("does nothing on an empty patch", () => {
    const { env, output } = setup();

    applyVolumeState({})(env)();

    expect(readVolumeState(env)()).toEqual(DEFAULT_VOLUME_STATE);
    expect(output).toEqual([]);
  });
});

describe("environment", () => {
  it("shares state between everything built on the same env", () => {
    const { env } = setup();
    const a = volumeApi(env);
    const b = volumeApi(env);

    a.setVolume(10);

    expect(b.getVolume()).toBe(10);
  });

  it("keeps separate envs independent", () => {
    const first = setup();
    const second = setup();

    setVolume(10)(first.env)();

    expect(getVolume(second.env)()).toBe(100);
  });

  it("lets the env decide where the state lives (e.g. a ref shared by the whole TV)", () => {
    const { env } = setup();
    const otherOutput: AudioOutput = { setVolume: () => IO.of(undefined), setMuted: () => IO.of(undefined) };
    const sameTv = { volumeState: env.volumeState, audioOutput: otherOutput };

    setVolume(25)(sameTv)();

    expect(getVolume(env)()).toBe(25);
  });
});
