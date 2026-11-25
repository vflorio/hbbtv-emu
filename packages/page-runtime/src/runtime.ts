/**
 * Wires the OIPF runtime with the web player, and exposes it to the host.
 */

import { DEFAULT_EXTENSION_STATE, type ExtensionState } from "@hbb-emu/extension-common";
import { createRuntimeEnv, type PlayerRuntimeFactory, type RuntimeHandle, runtime } from "@hbb-emu/oipf-runtime";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime } from "@hbb-emu/player-runtime";
import type { PageConfig } from "@hbb-emu/protocol";
import type * as IO from "fp-ts/IO";
import type { PageRuntimeControl } from "./host";

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

/**
 * Starts from the default configuration: the host's one is applied when it arrives.
 * One shared player for video/broadcast, a new one for every A/V Control object.
 */
export const startRuntime =
  (state: ExtensionState = DEFAULT_EXTENSION_STATE): IO.IO<RuntimeHandle> =>
  () =>
    runtime(createRuntimeEnv(state, createPlayerRuntime(), playerRuntimeFactory))();

/**
 * Today the runtime can only update the stream event schedule after start; the
 * channel list and the user agent are fixed at start (ROADMAP: config at start).
 */
export const controlRuntime = (handle: RuntimeHandle): PageRuntimeControl => ({
  applyConfig: (config: PageConfig) =>
    handle.updateExtensionState({
      ...DEFAULT_EXTENSION_STATE,
      userAgent: config.userAgent,
      channels: [...config.channels],
    }),
  dispatchKey: handle.dispatchKey,
});
