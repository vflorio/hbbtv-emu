/**
 * The application's own `<video>` and `<audio>`, in series with the TV's volume.
 *
 * TS 102 796 §10.2.12: the `volume` of an HTMLMediaElement, like `setVolume()` of a
 * video/broadcast, does not change the TV's volume; it only attenuates the element's
 * own audio, "in series" with the user's volume control, and its scale is linear in
 * amplitude. So the element plays at the product of the two, while the application
 * reads back the volume it set, and never sees the TV's.
 *
 * `HTMLMediaElement.prototype.volume` is replaced before the application's first
 * script: it keeps each element's volume for the application and writes the product
 * to the element. An element follows the TV's volume while it plays: it is brought
 * in line when it starts (`play()`, or the `play` event of one in the document) and
 * on every change of the TV's volume until it pauses.
 *
 * The videos of the OIPF objects are left alone (`EmulatorMedia`): their volume is
 * already in series with the TV's, on the object's own scale (`audioInSeries`).
 *
 * Not covered: an element outside the document that plays without `play()`
 * (`autoplay`); the application's iframes. A change of the TV's volume can fire a
 * `volumechange` on a playing element although its `volume` reads the same.
 */

import { createLogger } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import { type TvVolume, tvGain } from "./tvVolume";

const logger = createLogger("MediaElementVolume");

/** The media elements whose volume the emulator sets itself: the OIPF objects' videos. */
export type EmulatorMedia = Readonly<{
  add: (element: HTMLMediaElement) => IO.IO<void>;
  has: (element: HTMLMediaElement) => boolean;
}>;

export const createEmulatorMedia = (): EmulatorMedia => {
  const elements = new WeakSet<HTMLMediaElement>();
  return {
    add: (element) => () => {
      elements.add(element);
    },
    has: (element) => elements.has(element),
  };
};

export type MediaElementVolumeEnv = Readonly<{
  window: Window & typeof globalThis;
  tvVolume: TvVolume;
  emulatorMedia: EmulatorMedia;
}>;

/**
 * Installs the accessor; returns the effect that restores the browser's. Without a
 * `volume` accessor to wrap, it changes nothing.
 */
export const installMediaElementVolume: RIO.ReaderIO<MediaElementVolumeEnv, IO.IO<void>> = (env) => () => {
  const prototype = env.window.HTMLMediaElement.prototype;
  const original = Object.getOwnPropertyDescriptor(prototype, "volume");
  const originalPlay = Object.getOwnPropertyDescriptor(prototype, "play");
  if (!original?.get || !original.set || typeof originalPlay?.value !== "function") {
    logger.warn("HTMLMediaElement has no volume accessor: the application's media is not in series with the TV")();
    return () => {};
  }
  const nativeGet = original.get;
  const nativeSet = original.set;
  const nativePlay = originalPlay.value as HTMLMediaElement["play"];

  /** The application's volume, by element; 1 until it sets one, as in the browser. */
  const volumes = new WeakMap<HTMLMediaElement, number>();
  /** Elements that started playing since the TV's volume last changed. */
  const playing = new Set<HTMLMediaElement>();

  // The browser's own conversion and errors (TypeError, IndexSizeError) for a new
  // volume, on an element the page never sees.
  let scratch: HTMLMediaElement | null = null;
  const toVolume = (value: unknown): number => {
    scratch ??= env.window.document.createElement("audio");
    nativeSet.call(scratch, value);
    return nativeGet.call(scratch) as number;
  };

  const applicationVolume = (element: HTMLMediaElement): number => volumes.get(element) ?? 1;
  const output = (element: HTMLMediaElement) => {
    nativeSet.call(element, applicationVolume(element) * tvGain(env.tvVolume.get()));
  };
  const starts = (element: HTMLMediaElement) => {
    output(element);
    playing.add(element);
  };

  Object.defineProperty(prototype, "volume", {
    configurable: true,
    enumerable: original.enumerable,
    get(this: HTMLMediaElement) {
      const native = nativeGet.call(this) as number;
      return env.emulatorMedia.has(this) ? native : applicationVolume(this);
    },
    set(this: HTMLMediaElement, value: unknown) {
      if (env.emulatorMedia.has(this)) {
        nativeSet.call(this, value);
        return;
      }
      nativeGet.call(this);
      volumes.set(this, toVolume(value));
      output(this);
      if (!this.paused) playing.add(this);
    },
  });

  const wrapped = {
    play(this: HTMLMediaElement) {
      if (env.emulatorMedia.has(this)) return nativePlay.call(this);
      starts(this);
      return nativePlay.call(this);
    },
  };
  Object.defineProperty(prototype, "play", { ...originalPlay, value: wrapped.play });

  const onPlay = (event: Event) => {
    const element = event.target;
    if (element instanceof env.window.HTMLMediaElement && !env.emulatorMedia.has(element)) starts(element);
  };
  env.window.addEventListener("play", onPlay, true);

  const unsubscribe = env.tvVolume.subscribe(() => () => {
    for (const element of [...playing]) {
      output(element);
      if (element.paused) playing.delete(element);
    }
  })();

  return () => {
    unsubscribe();
    env.window.removeEventListener("play", onPlay, true);
    Object.defineProperty(prototype, "play", originalPlay);
    Object.defineProperty(prototype, "volume", original);
    playing.clear();
  };
};
