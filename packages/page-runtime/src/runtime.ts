/**
 * Wires the OIPF runtime with the web player, and exposes it to the host.
 */

import { type ChannelConfig, DEFAULT_EXTENSION_STATE, type ExtensionState } from "@hbb-emu/extension-common";
import { createRuntimeEnv, type PlayerRuntimeFactory, type RuntimeHandle, runtime } from "@hbb-emu/oipf-runtime";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime } from "@hbb-emu/player-runtime";
import { type BootstrapData, initialChannel, type PageConfig } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
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
export const toExtensionState = (config: PageConfig, currentChannel: ChannelConfig | null = null): ExtensionState => ({
  ...DEFAULT_EXTENSION_STATE,
  userAgent: config.userAgent,
  channels: [...config.channels],
  currentChannel,
});

/** Without bootstrap: the defaults, until the host's configuration arrives. */
const DEFAULT_BOOTSTRAP: BootstrapData = {
  config: { userAgent: DEFAULT_EXTENSION_STATE.userAgent, channels: DEFAULT_EXTENSION_STATE.channels },
  tunings: [],
};

/**
 * Starts with the host configuration when the page already has it (bootstrap),
 * with the defaults otherwise: the host's one is then applied when it arrives.
 * The channel is the one `initialChannel` says (the host opens the tab's session
 * with the same rule). One shared player for video/broadcast, a new one for every
 * A/V Control object.
 */
export const startRuntime =
  (url: string) =>
  (bootstrap: O.Option<BootstrapData> = O.none): IO.IO<RuntimeHandle> =>
  () => {
    const data = pipe(
      bootstrap,
      O.getOrElse(() => DEFAULT_BOOTSTRAP),
    );
    return runtime(
      createRuntimeEnv(
        toExtensionState(data.config, initialChannel(data, url)),
        createPlayerRuntime(),
        playerRuntimeFactory,
      ),
    )();
  };

/**
 * The bootstrap, when it runs after the runtime started (Chromium's order): applied
 * as if it had been there at start, channel included. Still before the
 * application's first script.
 */
export const applyBootstrap =
  (handle: RuntimeHandle, url: string) =>
  (data: BootstrapData): IO.IO<void> =>
    pipe(
      handle.updateExtensionState(toExtensionState(data.config)),
      IO.flatMap(() => handle.tune(initialChannel(data, url))),
    );

/** Configuration can be applied any time: the user agent and the channel lineup are live. */
export const controlRuntime = (handle: RuntimeHandle): PageRuntimeControl => ({
  applyConfig: (config: PageConfig) => handle.updateExtensionState(toExtensionState(config)),
  dispatchKey: handle.dispatchKey,
  applyState: handle.updateState,
  applySession: (session) => handle.tune(session.channel),
});
