import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmulatorMedia, type EmulatorMedia, installMediaElementVolume } from "./mediaElementVolume";
import { createTvVolume, type TvVolume } from "./tvVolume";

const prototype = HTMLMediaElement.prototype;
const browserVolume = Object.getOwnPropertyDescriptor(prototype, "volume") as PropertyDescriptor;
const browserPlay = Object.getOwnPropertyDescriptor(prototype, "play") as PropertyDescriptor;

/** What the element actually plays at: the browser's own accessor. */
const output = (element: HTMLMediaElement): number => browserVolume.get?.call(element) as number;

/** jsdom cannot play: `play()` only says it was called, and the element starts playing. */
const plays = vi.fn();
const setPaused = (value: boolean) => (element: HTMLMediaElement) =>
  Object.defineProperty(element, "paused", { value, configurable: true });
const playing = setPaused(false);
const paused = setPaused(true);

let tvVolume: TvVolume;
let emulatorMedia: EmulatorMedia;
let uninstall = () => {};

beforeEach(() => {
  plays.mockReset();
  Object.defineProperty(prototype, "play", {
    ...browserPlay,
    value(this: HTMLMediaElement) {
      plays(this);
      return Promise.resolve();
    },
  });
  tvVolume = createTvVolume(40);
  emulatorMedia = createEmulatorMedia();
  uninstall = installMediaElementVolume({ window, tvVolume, emulatorMedia })();
});

afterEach(() => {
  uninstall();
  Object.defineProperty(prototype, "play", browserPlay);
  document.body.innerHTML = "";
});

describe("the application's media, in series with the TV's volume (TS 102 796 §10.2.12)", () => {
  it("reads back the volume it set, and plays at its product with the TV's, linear in amplitude", () => {
    const video = document.createElement("video");

    video.volume = 0.5;

    expect(video.volume).toBe(0.5);
    expect(output(video)).toBeCloseTo(0.2);
  });

  it("an element the application never touched plays at the TV's volume once it starts", () => {
    const audio = new Audio();

    void audio.play();

    expect(audio.volume).toBe(1);
    expect(output(audio)).toBeCloseTo(0.4);
    expect(plays).toHaveBeenCalledWith(audio);
  });

  it("an element of the document that starts by itself (autoplay) is brought in line too", () => {
    const video = document.createElement("video");
    document.body.appendChild(video);

    video.dispatchEvent(new Event("play"));

    expect(output(video)).toBeCloseTo(0.4);
  });

  it("follows the TV's volume while it plays, and no longer once it paused", () => {
    const video = document.createElement("video");
    video.volume = 0.5;
    void video.play();
    playing(video);

    tvVolume.set(80)();
    expect(output(video)).toBeCloseTo(0.4);
    expect(video.volume).toBe(0.5);

    paused(video);
    tvVolume.set(100)();
    tvVolume.set(20)();
    expect(output(video)).toBeCloseTo(0.5);

    // Started again, it is in line with the TV's volume of now.
    void video.play();
    expect(output(video)).toBeCloseTo(0.1);
  });

  it("rejects what the browser rejects, and the volume stays", () => {
    const video = document.createElement("video");
    video.volume = 0.5;

    expect(() => {
      video.volume = 2;
    }).toThrow(expect.objectContaining({ name: "IndexSizeError" }));
    expect(() => {
      video.volume = Number.NaN;
    }).toThrow(expect.objectContaining({ name: "TypeError" }));
    expect(video.volume).toBe(0.5);
    expect(output(video)).toBeCloseTo(0.2);
  });

  it("converts what the browser converts", () => {
    const video = document.createElement("video");

    (video as unknown as { volume: unknown }).volume = "0.25";

    expect(video.volume).toBe(0.25);
  });

  it("leaves the OIPF objects' videos alone: their volume is already in series", () => {
    const video = document.createElement("video");
    emulatorMedia.add(video)();

    video.volume = 0.18;
    void video.play();
    playing(video);
    tvVolume.set(100)();

    expect(video.volume).toBeCloseTo(0.18);
    expect(output(video)).toBeCloseTo(0.18);
  });

  it("uninstalled, the browser's accessor is back", () => {
    uninstall();
    uninstall = () => {};

    expect(Object.getOwnPropertyDescriptor(prototype, "volume")).toEqual(browserVolume);
    const video = document.createElement("video");
    video.volume = 0.5;
    expect(output(video)).toBe(0.5);
  });
});
