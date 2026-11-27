import { Logger } from "@hbb-emu/core";
import { BROADCAST_STAND_IN } from "@hbb-emu/extension-common";
import {
  type DeviceCapabilities,
  DeviceCapabilitiesCodec,
  type DeviceProfile,
  DeviceProfileCodec,
  EMULATOR_CAPABILITIES,
  EMULATOR_TERMINAL,
  hbbtvUserAgent,
  isBaseUiProfile,
  isHbbTVVersion,
  TerminalIdentityCodec,
} from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOE from "fp-ts/IOEither";
import * as O from "fp-ts/Option";
import type * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { StorageAdapter } from "../../../adapter";
import { DEFAULT_STATE, type ExtensionState } from "../../../state";
import type { BackgroundServiceError } from "../background";

export type StateManagerEnv = {
  readonly storage: StorageAdapter<ExtensionState>;
};

/**
 * What older versions stored, as it comes back from JSON storage. Per-tab state
 * belongs to the tab's TV session (ROADMAP D5), not here:
 * - `enabledTabIds` was a Set (stored as `{}`, which crashed every update after a
 *   service-worker restart) that nothing read;
 * - `runtime.currentChannel` was one channel for every tab;
 * - the default lineup's stream was the DASH-IF live simulator, which limits its requests:
 *   channels still on it go to the test card the emulator ships;
 * - the TV was only its `userAgent`, a free text, and its HbbTV version was the
 *   Capabilities object's: see `storedDevice`;
 * - the capabilities were the Capabilities object's state (`api.oipfCapabilities`), which
 *   only reached the active tab: now they are the device's;
 * - the device's capabilities had DRM systems by id and `mediaFormats`, the emulator's:
 *   see `storedCapabilities`.
 */
type StoredState = Omit<ExtensionState, "runtime"> & {
  enabledTabIds?: unknown;
  runtime: Omit<ExtensionState["runtime"], "device"> & {
    currentChannel?: unknown;
    device?: unknown;
    userAgent?: unknown;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isStrings = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** The DRM system the emulator used to claim by default, without a DRM agent (Widevine). */
const OLD_DEFAULT_DRM_SYSTEM = "urn:dvb:casystemid:19219";

/**
 * The capabilities of a stored state, as the device's: the ones it has, or the older ones
 * (the Capabilities object's state, or the device's before `xmlCapabilities`).
 * - A UI profile without a base profile (the older defaults) gets the HD one of
 *   TS 102 796 §10.2.4.7: a terminal supports at least one (OIPF DAE §9.2).
 * - DRM systems by id become `<drm>` elements without formats, unless they are the old
 *   default, which no one chose.
 * - The media are the base level: `mediaFormats` were the emulator's, and its default
 *   listed everything.
 */
const storedCapabilities = (stored: unknown): DeviceCapabilities => {
  if (DeviceCapabilitiesCodec.is(stored)) return stored;
  const older = isRecord(stored) ? stored : {};
  const uiProfiles = isStrings(older.uiProfiles) ? older.uiProfiles : EMULATOR_CAPABILITIES.uiProfiles;
  const drmSystems = isStrings(older.drmSystems) ? older.drmSystems : [];
  const chosen = drmSystems.length === 1 && drmSystems[0] === OLD_DEFAULT_DRM_SYSTEM ? [] : drmSystems;
  return {
    uiProfiles: uiProfiles.some(isBaseUiProfile) ? uiProfiles : ["OITF_HD_UIPROF", ...uiProfiles],
    media: EMULATOR_CAPABILITIES.media,
    drm: chosen.map((systemId) => ({ systemId, formats: [] })),
  };
};

/**
 * The device of a stored state.
 * - One from before capabilities keeps its identity and its own header, with the
 *   capabilities it had, or the ones the Capabilities object had.
 * - One from before device profiles is the emulator, at the HbbTV version its Capabilities
 *   object had; the user agent it had stays its own header when it is not the one that
 *   identity gives (a custom one, or an older default).
 */
const storedDevice = (runtime: StoredState["runtime"]): DeviceProfile => {
  if (DeviceProfileCodec.is(runtime.device)) return runtime.device;
  const stored = runtime.api.oipfCapabilities;
  const before = runtime.device;
  if (isRecord(before) && TerminalIdentityCodec.is(before.terminal)) {
    const { terminal, userAgent } = before;
    const capabilities = storedCapabilities(before.capabilities ?? stored);
    return typeof userAgent === "string" ? { terminal, capabilities, userAgent } : { terminal, capabilities };
  }
  const capabilities = storedCapabilities(stored);
  const version = stored?.hbbtvVersion;
  const terminal = {
    ...EMULATOR_TERMINAL,
    hbbtvVersion: version !== undefined && isHbbTVVersion(version) ? version : EMULATOR_TERMINAL.hbbtvVersion,
  };
  const userAgent = runtime.userAgent;
  return typeof userAgent === "string" && userAgent !== "" && userAgent !== hbbtvUserAgent(terminal)
    ? { terminal, capabilities, userAgent }
    : { terminal, capabilities };
};

/** The previous default stream (`https://livesim2.dashif.org/livesim2/…`). */
const LIVE_SIMULATOR = /^https:\/\/livesim2\.dashif\.org\/livesim2\//;

export const fromStoredState = ({ enabledTabIds: _dropped, runtime, ...state }: StoredState): ExtensionState => {
  const { currentChannel: _droppedToo, userAgent: _inTheDevice, device: _decoded, ...kept } = runtime;
  const { oipfCapabilities: _theDevices, ...api } = kept.api;
  return {
    ...state,
    runtime: {
      ...kept,
      api,
      device: storedDevice(runtime),
      channels: kept.channels.map((channel) =>
        LIVE_SIMULATOR.test(channel.mp4Source) ? { ...channel, mp4Source: BROADCAST_STAND_IN } : channel,
      ),
    },
  };
};

export class StateManager {
  private state: O.Option<ExtensionState> = O.none;
  private logger: Logger;

  constructor(private readonly env: StateManagerEnv) {
    this.logger = new Logger("StateManager");
  }

  /**
   * Initializes state from storage or creates default if empty.
   */
  readonly init = (): TE.TaskEither<BackgroundServiceError, void> =>
    pipe(
      TE.Do,
      TE.tapIO(() => this.logger.info("Initializing")),
      TE.flatMap(() => this.getInitialState()),
      TE.tapIO((state) => this.setState(state)),
      TE.tapIO(() => this.logger.info("Initialized")),
      TE.asUnit,
    );

  /**
   * Cleanup resources
   */
  readonly destroy = (): IO.IO<void> =>
    pipe(
      IO.Do,
      IO.tap(() => this.logger.info("Destroying")),
      IO.tap(() => () => {
        this.state = O.none;
      }),
      IO.tap(() => this.logger.info("Destroyed")),
    );

  readonly setLogger =
    (logger: Logger): IO.IO<void> =>
    () => {
      this.logger = logger.create("StateManager");
    };

  /**
   * Loads state from storage or returns default
   */
  private readonly getInitialState = (): TE.TaskEither<BackgroundServiceError, ExtensionState> =>
    pipe(this.env.storage.read(), TE.map(O.match(() => DEFAULT_STATE, fromStoredState)));

  /**
   * Returns current state. Fails if not initialized.
   */
  readonly getState = (): IOE.IOEither<BackgroundServiceError, ExtensionState> =>
    pipe(
      this.state,
      IOE.fromOption(() => ({ _tag: "StateNotInitialized" })),
    );

  /**
   * Sets state locally
   */
  private readonly setState =
    (state: ExtensionState): IO.IO<void> =>
    () => {
      this.state = O.some(state);
    };

  /**
   * Updates state locally and persists to storage
   */
  readonly updateState = (handler: (state: ExtensionState) => ExtensionState): T.Task<void> =>
    pipe(
      this.getState(),
      IOE.map(handler),
      IOE.map((newState) => ({ ...newState, lastUpdated: Date.now() })),
      TE.fromIOEither,
      TE.tapIO((newState) => this.setState(newState)),
      TE.tap((newState) => this.persistState(newState)),
      TE.match(
        (error) => {
          this.logger.error("Failed to update state", error);
        },
        () => {
          this.logger.debug("State updated successfully");
        },
      ),
    );

  /**
   * Persists state to storage
   */
  private readonly persistState = (state: ExtensionState): TE.TaskEither<BackgroundServiceError, void> =>
    pipe(
      this.env.storage.write(state),
      TE.tapIO(() => this.logger.debug("State persisted to storage")),
    );
}
