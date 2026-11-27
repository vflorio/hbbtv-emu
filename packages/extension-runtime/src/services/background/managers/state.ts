import { Logger } from "@hbb-emu/core";
import { BROADCAST_STAND_IN } from "@hbb-emu/extension-common";
import {
  type DeviceProfile,
  DeviceProfileCodec,
  EMULATOR_TERMINAL,
  hbbtvUserAgent,
  isHbbTVVersion,
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
 *   Capabilities object's: see `storedDevice`.
 */
type StoredState = Omit<ExtensionState, "runtime"> & {
  enabledTabIds?: unknown;
  runtime: Omit<ExtensionState["runtime"], "device"> & {
    currentChannel?: unknown;
    device?: unknown;
    userAgent?: unknown;
  };
};

/**
 * The device of a stored state. One from before device profiles is the emulator, at the
 * HbbTV version its Capabilities object had; the user agent it had stays its own header
 * when it is not the one that identity gives (a custom one, or an older default).
 */
const storedDevice = (runtime: StoredState["runtime"]): DeviceProfile => {
  if (DeviceProfileCodec.is(runtime.device)) return runtime.device;
  const version = runtime.api.oipfCapabilities?.hbbtvVersion;
  const terminal = {
    ...EMULATOR_TERMINAL,
    hbbtvVersion: version !== undefined && isHbbTVVersion(version) ? version : EMULATOR_TERMINAL.hbbtvVersion,
  };
  const userAgent = runtime.userAgent;
  return typeof userAgent === "string" && userAgent !== "" && userAgent !== hbbtvUserAgent(terminal)
    ? { terminal, userAgent }
    : { terminal };
};

/** The previous default stream (`https://livesim2.dashif.org/livesim2/…`). */
const LIVE_SIMULATOR = /^https:\/\/livesim2\.dashif\.org\/livesim2\//;

export const fromStoredState = ({ enabledTabIds: _dropped, runtime, ...state }: StoredState): ExtensionState => {
  const { currentChannel: _droppedToo, userAgent: _inTheDevice, device: _decoded, ...kept } = runtime;
  return {
    ...state,
    runtime: {
      ...kept,
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
