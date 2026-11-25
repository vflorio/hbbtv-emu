/**
 * Wires the OIPF runtime with the web player, and exposes it to the host.
 */

import { DEFAULT_EXTENSION_STATE, type ExtensionState } from "@hbb-emu/extension-common";
import { createRuntimeEnv, type PlayerRuntimeFactory, type RuntimeHandle, runtime } from "@hbb-emu/oipf-runtime";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime } from "@hbb-emu/player-runtime";
import type { PageConfig } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import { toBroadcastChannel } from "./channel";
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

/** The runtime still takes the old extension state: the host configuration over the defaults. */
export const toExtensionState = (config: PageConfig): ExtensionState => ({
  ...DEFAULT_EXTENSION_STATE,
  userAgent: config.userAgent,
  channels: [...config.channels],
});

/**
 * Starts with the host configuration when the page already has it (bootstrap),
 * with the defaults otherwise: the host's one is then applied when it arrives.
 * One shared player for video/broadcast, a new one for every A/V Control object.
 */
export const startRuntime =
  (config: O.Option<PageConfig> = O.none): IO.IO<RuntimeHandle> =>
  () =>
    runtime(
      createRuntimeEnv(
        pipe(
          config,
          O.match(() => DEFAULT_EXTENSION_STATE, toExtensionState),
        ),
        createPlayerRuntime(),
        playerRuntimeFactory,
      ),
    )();

/** Configuration can be applied any time: the user agent and the channel lineup are live. */
export const controlRuntime = (handle: RuntimeHandle): PageRuntimeControl => ({
  applyConfig: (config: PageConfig) => handle.updateExtensionState(toExtensionState(config)),
  dispatchKey: handle.dispatchKey,
  applyState: handle.updateState,
  playChannel: (channel) =>
    handle.updateState({
      videoBroadcast: { currentChannel: toBroadcastChannel(channel) as never },
    }),
});
