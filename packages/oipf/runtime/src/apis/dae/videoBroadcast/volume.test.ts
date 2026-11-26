import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import { createTvVolume, tvGain } from "../../../subsystems/tvVolume";
import {
  type AudioOutput,
  applyVolumeState,
  audioInSeries,
  broadcastGain,
  createVolumeEnv,
  DEFAULT_VOLUME_STATE,
  getVolume,
  linearGain,
  parseVolume,
  readVolumeState,
  resetVolume,
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

describe("resetVolume (the object entered the unrealized state)", () => {
  it("brings the volume back to 100, keeping mute", () => {
    const { env, output } = setup({ volume: 86, muted: true });

    resetVolume(env)();

    expect(readVolumeState(env)()).toEqual({ volume: 100, muted: true });
    expect(output).toEqual([{ volume: 100 }]);
  });

  it("at 100 already, leaves the output alone", () => {
    const { env, output } = setup();

    resetVolume(env)();

    expect(output).toEqual([]);
  });
});

describe("volume scales (TS 102 796 §10.2.12)", () => {
  it("video/broadcast attenuates by 100 − volume dB, and mutes at 0", () => {
    expect(broadcastGain(100)).toBe(1);
    // The spec's example: 14 dB, a factor of 0.2, is 86.
    expect(broadcastGain(86)).toBeCloseTo(0.2, 2);
    expect(broadcastGain(80)).toBeCloseTo(0.1, 5);
    expect(broadcastGain(0)).toBe(0);
  });

  it("A/V Control and the TV are linear in amplitude", () => {
    expect([0, 50, 100].map(linearGain)).toEqual([0, 0.5, 1]);
    expect([0, 50, 100].map(tvGain)).toEqual([0, 0.5, 1]);
  });
});

describe("audioInSeries", () => {
  const setupInSeries = (tv: number, initial?: number) => {
    const tvVolume = createTvVolume(tv);
    const element = document.createElement("video");
    const output = audioInSeries(tvVolume, linearGain, element, () => IO.of(undefined), initial)();
    return { tvVolume, element, output };
  };

  it("plays at the TV's volume from the start", () => {
    const { element } = setupInSeries(40);

    expect(element.volume).toBeCloseTo(0.4);
  });

  it("the object's volume only attenuates the TV's", () => {
    const { element, output } = setupInSeries(40);

    output.setVolume(50)();

    expect(element.volume).toBeCloseTo(0.2);
  });

  it("follows the TV's volume, keeping the object's", () => {
    const { tvVolume, element, output } = setupInSeries(40);
    output.setVolume(50)();

    tvVolume.set(100)();

    expect(element.volume).toBeCloseTo(0.5);
  });

  it("starts from the object's initial volume", () => {
    const { element } = setupInSeries(100, 30);

    expect(element.volume).toBeCloseTo(0.3);
  });
});
