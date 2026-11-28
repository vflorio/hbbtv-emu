/**
 * Wires the OIPF runtime with the web player, and exposes it to the host.
 */

import { type ChannelConfig, DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { EMULATOR_DEVICE } from "@hbb-emu/oipf-api";
import {
  type ApplicationExit,
  type ApplicationLaunch,
  type ChannelChangeRequest,
  createRuntimeEnv,
  exitAlone,
  type FetchStreamEventDescription,
  fetchFromPage,
  ignoreTvKey,
  launchAlone,
  type PlayerRuntimeFactory,
  type RuntimeHandle,
  type RuntimeState,
  reportNowhere,
  runtime,
  tuneAlone,
} from "@hbb-emu/oipf-runtime";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime } from "@hbb-emu/player-runtime";
import { type BootstrapData, initialActivation, initialChannel, type PageConfig } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import type { HostApplicationLaunches } from "./applicationLaunch";
import type { HostChannelChanges } from "./channelChange";
import type { PageRuntimeControl } from "./host";
import type { HostStreamEventDescriptions } from "./streamEventDescriptions";

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
export const toExtensionState = (
  config: PageConfig,
  currentChannel: ChannelConfig | null = null,
  activated = true,
): RuntimeState => ({
  ...DEFAULT_EXTENSION_STATE,
  userAgent: config.userAgent,
  device: config.device,
  channels: [...config.channels],
  currentChannel,
  activated,
});

/** Without bootstrap: the defaults, until the host's configuration arrives. */
const DEFAULT_BOOTSTRAP: BootstrapData = {
  config: {
    userAgent: DEFAULT_EXTENSION_STATE.userAgent,
    device: EMULATOR_DEVICE,
    channels: DEFAULT_EXTENSION_STATE.channels,
  },
  tunings: [],
};

/** What the runtime asks of the host. */
export type HostRequests = Readonly<{
  /** The application's channel changes (`setChannel()`). */
  requestChannelChange: ChannelChangeRequest;
  /** A key the TV keeps for itself (P+/P-, volume), pressed on the keyboard. */
  pressTvKey: (keyCode: number) => IO.IO<void>;
  /** The XML descriptions of stream events (TS 102 796 §8.2.1.1). */
  fetchStreamEventDescription: FetchStreamEventDescription;
  /** The application exits (`destroyApplication()`). */
  exitApplication: ApplicationExit;
  /** The application starts another (`createApplication()`). */
  launchApplication: ApplicationLaunch;
  /** The application got activated by its first key event (TS 102 796 §10.2.2.1). */
  reportActivation: IO.IO<void>;
}>;

/**
 * Without a host, the objects tune by themselves, the TV's keys do nothing, the page
 * fetches the stream event descriptions (subject to CORS, unlike a TV), an
 * application that exits keeps running, one that starts another at an HTTP(S)
 * URL just goes there, and the activation lasts as long as the page.
 */
export const WITHOUT_HOST: HostRequests = {
  requestChannelChange: tuneAlone,
  pressTvKey: ignoreTvKey,
  fetchStreamEventDescription: fetchFromPage,
  exitApplication: exitAlone,
  launchApplication: launchAlone,
  reportActivation: reportNowhere,
};

/**
 * Starts with the host configuration when the page already has it (bootstrap),
 * with the defaults otherwise: the host's one is then applied when it arrives.
 * The channel is the one `initialChannel` says, and the activation the one
 * `initialActivation` says (the host opens the tab's session with the same rules). One shared player for video/broadcast, a new one for every
 * A/V Control object. The application's channel changes and the TV's keys go to
 * `host` (the host's, once connected).
 */
export const startRuntime =
  (url: string, host: HostRequests = WITHOUT_HOST) =>
  (bootstrap: O.Option<BootstrapData> = O.none): IO.IO<RuntimeHandle> =>
  () => {
    const data = pipe(
      bootstrap,
      O.getOrElse(() => DEFAULT_BOOTSTRAP),
    );
    const env = createRuntimeEnv(
      toExtensionState(data.config, initialChannel(data, url), initialActivation(data, url)),
      createPlayerRuntime(),
      playerRuntimeFactory,
    );
    return runtime({
      ...env,
      bindings: {
        ...env.bindings,
        requestChannelChange: host.requestChannelChange,
        fetchStreamEventDescription: host.fetchStreamEventDescription,
        exitApplication: host.exitApplication,
        launchApplication: host.launchApplication,
      },
      keyboard: { ...env.keyboard, pressTvKey: host.pressTvKey },
      activation: { ...env.activation, report: host.reportActivation },
    })();
  };

/**
 * The bootstrap, when it runs after the runtime started (Chromium's order): applied
 * as if it had been there at start, channel and activation included. Still before
 * the application's first script.
 */
export const applyBootstrap =
  (handle: RuntimeHandle, url: string) =>
  (data: BootstrapData): IO.IO<void> =>
    pipe(
      handle.updateExtensionState(toExtensionState(data.config)),
      IO.flatMap(() => handle.tune(initialChannel(data, url))),
      IO.flatMap(() => handle.tellActivation(initialActivation(data, url))),
    );

/**
 * Configuration can be applied any time: the user agent and the channel lineup are
 * live. A new session tunes the TV, sets its volume and says whether the application
 * is activated first, then settles the application's requests for that channel (its
 * objects are already there).
 */
export const controlRuntime = (
  handle: RuntimeHandle,
  changes: HostChannelChanges,
  descriptions: HostStreamEventDescriptions,
  launches: HostApplicationLaunches,
): PageRuntimeControl => ({
  applyConfig: (config: PageConfig) => handle.updateExtensionState(toExtensionState(config)),
  dispatchKey: handle.dispatchKey,
  applyState: handle.updateState,
  applySession: (session) =>
    pipe(
      handle.tune(session.channel),
      IO.flatMap(() => handle.setTvVolume(session.volume)),
      IO.flatMap(() => handle.tellActivation(session.activated)),
      IO.flatMap(() => changes.settle(session)),
    ),
  channelChangeFailed: changes.fail,
  streamEventDescriptionFetched: descriptions.settle,
  applicationLoadFailed: launches.fail,
});
