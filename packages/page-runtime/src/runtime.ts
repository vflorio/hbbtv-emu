/**
 * Wires the OIPF runtime with the web player.
 *
 * For now the runtime starts from the default extension state; syncing with the
 * host's control plane (scenario, TV session) comes with the bridge (ROADMAP 1.2).
 */

import { DEFAULT_EXTENSION_STATE, type ExtensionState } from "@hbb-emu/extension-common";
import { createRuntimeEnv, type PlayerRuntimeFactory, type RuntimeHandle, runtime } from "@hbb-emu/oipf-runtime";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime } from "@hbb-emu/player-runtime";
import type * as IO from "fp-ts/IO";

const createPlayerRuntime = (): PlayerRuntime =>
  new PlayerRuntime({
    adapters: {
      native: new NativeAdapter(),
      hls: new HLSAdapter(),
      dash: new DASHAdapter(),
    },
  });

const playerRuntimeFactory: PlayerRuntimeFactory = {
  create: createPlayerRuntime,
  destroy: (playerRuntime) => {
    void playerRuntime.destroy()();
  },
};

/** One shared player for video/broadcast, a new one for every A/V Control object. */
export const startRuntime =
  (state: ExtensionState = DEFAULT_EXTENSION_STATE): IO.IO<RuntimeHandle> =>
  () =>
    runtime(createRuntimeEnv(state, createPlayerRuntime(), playerRuntimeFactory))();
