/**
 * Wires the OIPF runtime with the web player, and exposes it to the host.
 */

import { type ChannelConfig, DEFAULT_EXTENSION_STATE, type ExtensionState } from "@hbb-emu/extension-common";
import { channelSignalling } from "@hbb-emu/oipf-api";
import { createRuntimeEnv, type PlayerRuntimeFactory, type RuntimeHandle, runtime } from "@hbb-emu/oipf-runtime";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime } from "@hbb-emu/player-runtime";
import type { PageConfig } from "@hbb-emu/protocol";
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

const DEFAULT_CONFIG: PageConfig = {
  userAgent: DEFAULT_EXTENSION_STATE.userAgent,
  channels: DEFAULT_EXTENSION_STATE.channels,
};

/**
 * The channel a page starts on, before the host says which one its tab is tuned to:
 * the channel whose AIT signals the page's application, the first of the lineup
 * otherwise. The background opens a tab's session the same way, so for the first
 * page of a tab the two agree and the session does not retune it.
 */
export const initialChannel = (config: PageConfig, url: string): ChannelConfig | null =>
  channelSignalling(config.channels, url) ?? config.channels[0] ?? null;

/**
 * Starts with the host configuration when the page already has it (bootstrap),
 * with the defaults otherwise: the host's one is then applied when it arrives.
 * One shared player for video/broadcast, a new one for every A/V Control object.
 */
export const startRuntime =
  (url: string) =>
  (bootstrap: O.Option<PageConfig> = O.none): IO.IO<RuntimeHandle> =>
  () => {
    const config = pipe(
      bootstrap,
      O.getOrElse(() => DEFAULT_CONFIG),
    );
    return runtime(
      createRuntimeEnv(
        toExtensionState(config, initialChannel(config, url)),
        createPlayerRuntime(),
        playerRuntimeFactory,
      ),
    )();
  };

/**
 * The bootstrap configuration, when it runs after the runtime started (Chromium's
 * order): applied as if it had been there at start, channel included. Still before
 * the application's first script.
 */
export const applyBootstrapConfig =
  (handle: RuntimeHandle, url: string) =>
  (config: PageConfig): IO.IO<void> =>
    pipe(
      handle.updateExtensionState(toExtensionState(config)),
      IO.flatMap(() => handle.tune(initialChannel(config, url))),
    );

/** Configuration can be applied any time: the user agent and the channel lineup are live. */
export const controlRuntime = (handle: RuntimeHandle): PageRuntimeControl => ({
  applyConfig: (config: PageConfig) => handle.updateExtensionState(toExtensionState(config)),
  dispatchKey: handle.dispatchKey,
  applyState: handle.updateState,
  applySession: (session) => handle.tune(session.channel),
});
