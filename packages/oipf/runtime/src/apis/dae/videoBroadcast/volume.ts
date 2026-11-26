/**
 * video/broadcast — volume
 *
 * OIPF DAE `setVolume()` / `getVolume()` (HbbTV 1.7.1+), plus the emulator-only
 * `muted` flag driven by the settings UI.
 *
 * Reader-style module (ROADMAP D1): the logic is a set of `ReaderIO<VolumeEnv, A>`
 * functions that only depend on what `VolumeEnv` provides, so it can be tested with
 * a fake environment and composed without inheritance.
 *
 * Source of truth is `VolumeEnv.volumeState`, not the video element: the player
 * applies volume asynchronously, while `getVolume()` must reflect `setVolume()`
 * immediately, as it does on a TV.
 */

import { DEFAULT_MUTED, DEFAULT_VOLUME, type OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type * as R from "fp-ts/Reader";
import * as RIO from "fp-ts/ReaderIO";
import { type TvVolume, tvGain } from "../../../subsystems/tvVolume";

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

export type VolumeState = Readonly<{
  /** Integer, 0–100. */
  volume: number;
  muted: boolean;
}>;

export const DEFAULT_VOLUME_STATE: VolumeState = { volume: DEFAULT_VOLUME, muted: DEFAULT_MUTED };

/** Where the audio actually goes (the player). Write-only on purpose. */
export type AudioOutput = Readonly<{
  setVolume: (volume: number) => IO.IO<void>;
  setMuted: (muted: boolean) => IO.IO<void>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Volume scales, in series with the TV's volume
// ─────────────────────────────────────────────────────────────────────────────

/**
 * video/broadcast (TS 102 796 §10.2.12): `volume` attenuates the object's audio by
 * `100 − volume` dB, and mutes it at 0. 100 is no attenuation; 86 is a factor of 0.2.
 */
export const broadcastGain = (volume: number): number => (volume <= 0 ? 0 : 10 ** (-(100 - volume) / 20));

/**
 * A/V Control: CEA-2014's "linear increase of the volume as a percentage of the
 * master volume", read as linear in amplitude. HbbTV only defines the scale more
 * precisely for video/broadcast.
 */
export const linearGain = (volume: number): number => Math.max(0, volume) / 100;

/**
 * An object's audio output "in series" with the TV's volume (§10.2.12): the media
 * element plays at the product of the TV's gain and the object's, applied at once
 * and again whenever the TV's volume changes. Written to the element itself, which
 * outlives the player's adapters (the player only sets a volume once it has one).
 */
export const audioInSeries =
  (
    tvVolume: TvVolume,
    gain: (volume: number) => number,
    element: HTMLMediaElement,
    setMuted: AudioOutput["setMuted"],
    initialVolume: number = DEFAULT_VOLUME,
  ): IO.IO<AudioOutput> =>
  () => {
    let objectVolume = initialVolume;
    const output = (tv: number) => {
      element.volume = Math.min(1, tvGain(tv) * gain(objectVolume));
    };
    output(tvVolume.get());
    tvVolume.subscribe((tv) => () => output(tv))();
    return {
      setVolume: (volume) => () => {
        objectVolume = volume;
        output(tvVolume.get());
      },
      setMuted,
    };
  };

export type VolumeEnv = Readonly<{
  volumeState: IORef<VolumeState>;
  audioOutput: AudioOutput;
}>;

export const createVolumeEnv = (
  audioOutput: AudioOutput,
  initial: VolumeState = DEFAULT_VOLUME_STATE,
): IO.IO<VolumeEnv> =>
  pipe(
    newIORef(initial),
    IO.map((volumeState) => ({ volumeState, audioOutput })),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 100;

/**
 * Accepts a volume level as an OIPF `Integer`.
 * Non-integer numbers are truncated (WebIDL integer conversion); anything that is
 * not a finite number in [0, 100] is rejected, and the volume does not change.
 */
export const parseVolume = (input: unknown): O.Option<number> =>
  pipe(
    O.fromPredicate((value: unknown): value is number => typeof value === "number" && Number.isFinite(value))(input),
    O.map(Math.trunc),
    O.filter((value) => value >= MIN_VOLUME && value <= MAX_VOLUME),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

export const getVolume: RIO.ReaderIO<VolumeEnv, number> = ({ volumeState }) =>
  pipe(
    volumeState.read,
    IO.map((state) => state.volume),
  );

export const readVolumeState: RIO.ReaderIO<VolumeEnv, VolumeState> = ({ volumeState }) => volumeState.read;

const writeVolume =
  (volume: number): RIO.ReaderIO<VolumeEnv, void> =>
  ({ volumeState, audioOutput }) =>
    pipe(
      volumeState.modify((state) => ({ ...state, volume })),
      IO.flatMap(() => audioOutput.setVolume(volume)),
    );

const writeMuted =
  (muted: boolean): RIO.ReaderIO<VolumeEnv, void> =>
  ({ volumeState, audioOutput }) =>
    pipe(
      volumeState.modify((state) => ({ ...state, muted })),
      IO.flatMap(() => audioOutput.setMuted(muted)),
    );

/**
 * `setVolume(volume)`: returns `true` only if the volume actually changed.
 * Invalid values and the current value leave everything untouched and return `false`.
 */
export const setVolume = (input: number): RIO.ReaderIO<VolumeEnv, boolean> =>
  pipe(
    getVolume,
    RIO.flatMap((current) =>
      pipe(
        parseVolume(input),
        O.filter((volume) => volume !== current),
        O.match(
          () => RIO.of(false),
          (volume) =>
            pipe(
              writeVolume(volume),
              RIO.map(() => true),
            ),
        ),
      ),
    ),
  );

/**
 * Applies external state (settings UI, scenario). Invalid volumes are ignored;
 * only the fields that change reach the audio output.
 */
export const applyVolumeState = (patch: Partial<VolumeState>): RIO.ReaderIO<VolumeEnv, void> =>
  pipe(
    readVolumeState,
    RIO.flatMap((current) =>
      pipe(
        RIO.Do,
        RIO.tap(() =>
          pipe(
            O.fromNullable(patch.volume),
            O.flatMap(parseVolume),
            O.filter((volume) => volume !== current.volume),
            O.match(() => RIO.of(undefined), writeVolume),
          ),
        ),
        RIO.tap(() =>
          pipe(
            O.fromNullable(patch.muted),
            O.filter((muted) => muted !== current.muted),
            O.match(() => RIO.of(undefined), writeMuted),
          ),
        ),
      ),
    ),
    RIO.asUnit,
  );

/**
 * The object entered the unrealized state: the application's volume "shall cease to
 * have any effect" (TS 102 796 §10.2.12), so the object plays at full volume again,
 * in series with the TV's, and `getVolume()` says so. A later bind starts from there.
 * Mute is the settings UI's, not the application's: it stays.
 */
export const resetVolume: RIO.ReaderIO<VolumeEnv, void> = applyVolumeState({ volume: DEFAULT_VOLUME });

// ─────────────────────────────────────────────────────────────────────────────
// OIPF surface
// ─────────────────────────────────────────────────────────────────────────────

export type VolumeApi = Pick<OIPF.DAE.Broadcast.VideoBroadcast, "setVolume" | "getVolume">;

/** The methods exposed to HbbTV applications: plain synchronous functions, as the spec defines them. */
export const volumeApi: R.Reader<VolumeEnv, VolumeApi> = (env) => ({
  setVolume: (volume) => setVolume(volume)(env)(),
  getVolume: () => getVolume(env)(),
});
