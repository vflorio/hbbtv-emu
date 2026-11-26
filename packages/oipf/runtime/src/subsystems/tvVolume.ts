/**
 * The TV's own volume: the user's (VOL+/VOL-), 0–100, kept by the host in the tab's
 * TV session. Applications can neither read nor change it (HbbTV does not include
 * `LocalSystem.volume`): the volume of their objects only attenuates their own audio,
 * "in series" with this one (TS 102 796 §10.2.12).
 */

import type * as IO from "fp-ts/IO";

export type TvVolume = Readonly<{
  get: IO.IO<number>;
  set: (volume: number) => IO.IO<void>;
  /** `listener` is called on every change; returns the unsubscribe effect. */
  subscribe: (listener: (volume: number) => IO.IO<void>) => IO.IO<IO.IO<void>>;
}>;

export const MAX_TV_VOLUME = 100;

const clamp = (volume: number): number =>
  Number.isFinite(volume) ? Math.max(0, Math.min(MAX_TV_VOLUME, Math.round(volume))) : MAX_TV_VOLUME;

/** Until the host says otherwise, the TV is at full volume: the browser's own. */
export const createTvVolume = (initial: number = MAX_TV_VOLUME): TvVolume => {
  let volume = clamp(initial);
  const listeners = new Set<(volume: number) => IO.IO<void>>();
  return {
    get: () => volume,
    set: (next) => () => {
      const clamped = clamp(next);
      if (clamped === volume) return;
      volume = clamped;
      for (const listener of [...listeners]) listener(volume)();
    },
    subscribe: (listener) => () => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/**
 * The amplitude factor of the TV's volume. The emulator's choice (the TV's scale is
 * its own): linear in amplitude, as `HTMLMediaElement.volume` is.
 */
export const tvGain = (volume: number): number => clamp(volume) / MAX_TV_VOLUME;
