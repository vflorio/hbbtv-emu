/**
 * video/broadcast — data, programmes, and the handlers of what the emulator does
 * not produce yet (programmes, parental rating, DRM).
 *
 * Reader-style module (ROADMAP D1): the programmes live in an injected `IORef`.
 * - `data` has no meaning for a video/broadcast: setting it has no effect, reading
 *   it gives the empty string (OIPF DAE §7.13.1.2);
 * - `programmes` is the collection the settings UI or a scenario provides.
 */

import type { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import type * as R from "fp-ts/Reader";
import type * as RIO from "fp-ts/ReaderIO";

type Programme = OIPF.DAE.Broadcast.Programme;

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

export type MiscEnv = Readonly<{
  programmes: IORef<ReadonlyArray<Programme>>;
}>;

export const createMiscEnv: IO.IO<MiscEnv> = pipe(
  newIORef<ReadonlyArray<Programme>>([]),
  IO.map((programmes) => ({ programmes })),
);

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

export const readProgrammes: RIO.ReaderIO<MiscEnv, ReadonlyArray<Programme>> = ({ programmes }) => programmes.read;

/** External state (settings UI, scenario): the object keeps its own copy. */
export const applyProgrammes =
  (list: ReadonlyArray<Programme>): RIO.ReaderIO<MiscEnv, void> =>
  ({ programmes }) =>
    programmes.write([...list]);

// ─────────────────────────────────────────────────────────────────────────────
// OIPF surface
// ─────────────────────────────────────────────────────────────────────────────

export type MiscApi = Pick<
  OIPF.DAE.Broadcast.VideoBroadcast,
  "data" | "onProgrammesChanged" | "onParentalRatingChange" | "onParentalRatingError" | "onDRMRightsError"
> &
  Readonly<Pick<OIPF.DAE.Broadcast.VideoBroadcast, "programmes">>;

export const miscApi: R.Reader<MiscEnv, MiscApi> = (env) => ({
  get data() {
    return "";
  },
  set data(_value: string) {
    // No effect on a video/broadcast.
  },
  get programmes() {
    const list = readProgrammes(env)();
    return { length: list.length, item: (index: number) => list[index] };
  },
  onProgrammesChanged: null,
  onParentalRatingChange: null,
  onParentalRatingError: null,
  onDRMRightsError: null,
});
