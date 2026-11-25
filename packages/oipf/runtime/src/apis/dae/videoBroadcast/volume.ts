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

// ─────────────────────────────────────────────────────────────────────────────
// OIPF surface
// ─────────────────────────────────────────────────────────────────────────────

export type VolumeApi = Pick<OIPF.DAE.Broadcast.VideoBroadcast, "setVolume" | "getVolume">;

/** The methods exposed to HbbTV applications: plain synchronous functions, as the spec defines them. */
export const volumeApi: R.Reader<VolumeEnv, VolumeApi> = (env) => ({
  setVolume: (volume) => setVolume(volume)(env)(),
  getVolume: () => getVolume(env)(),
});
