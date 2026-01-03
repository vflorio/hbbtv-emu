/**
 * StateManager - Manages extension state lifecycle and persistence
 *
 * Encapsulates all state management logic including:
 * - State initialization and loading from storage
 * - State updates and persistence
 * - Tab-specific state management
 * - Settings management
 */
import type { Logger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOE from "fp-ts/IOEither";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { StorageAdapter } from "../../../adapters";
import type { BackgroundServiceError } from "../errors";
import { DEFAULT_STATE, type ExtensionState } from "../state";

export type StateManagerEnv = {
  readonly storage: StorageAdapter<ExtensionState>;
};

export class StateManager {
  private state: O.Option<ExtensionState> = O.none;
  private initialized = false;

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  constructor(
    private readonly env: StateManagerEnv,
    private readonly logger: Logger,
  ) {}

  /**
   * Initializes state from storage or creates default if empty.
   * Must be called before any other state operations.
   */
  readonly init = (): TE.TaskEither<BackgroundServiceError, void> =>
    pipe(
      TE.Do,
      TE.tapIO(() => this.logger.info("Initializing StateManager...")),
      TE.flatMap(() => this.getInitialState()),
      TE.tapIO((state) => this.setState(state)),
      TE.tapIO(() => () => {
        this.initialized = true;
      }),
      TE.tapIO(() => this.logger.info("StateManager initialized")),
      TE.asUnit,
    );

  /**
   * Cleanup resources
   */
  readonly destroy = (): IO.IO<void> =>
    pipe(
      IO.Do,
      IO.tap(() => this.logger.info("Destroying StateManager...")),
      IO.tap(() => () => {
        this.state = O.none;
        this.initialized = false;
      }),
      IO.tap(() => this.logger.info("StateManager destroyed")),
    );

  /**
   * Loads state from storage or returns default
   */
  private readonly getInitialState = (): TE.TaskEither<BackgroundServiceError, ExtensionState> =>
    pipe(this.env.storage.read(), TE.map(O.getOrElse(() => DEFAULT_STATE)));

  // ===========================================================================
  // STATE ACCESS
  // ===========================================================================

  /**
   * Returns current state. Fails if not initialized.
   */
  readonly getState = (): IOE.IOEither<BackgroundServiceError, ExtensionState> =>
    pipe(
      IO.of(this.state),
      IO.map(
        O.match(
          (): IOE.IOEither<BackgroundServiceError, ExtensionState> => IOE.left({ _tag: "StateNotInitialized" }),
          (s): IOE.IOEither<BackgroundServiceError, ExtensionState> => IOE.right(s),
        ),
      ),
      IO.flatten,
    );

  /**
   * Returns whether state is initialized
   */
  readonly isInitialized = (): IO.IO<boolean> => () => this.initialized;

  // ===========================================================================
  // STATE MUTATION
  // ===========================================================================

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

  // ===========================================================================
  // TAB MANAGEMENT
  // ===========================================================================

  /**
   * Enables HbbTV for a specific tab
   */
  readonly enableTab = (tabId: number): T.Task<void> =>
    pipe(
      this.updateState((state) => ({
        ...state,
        enabledTabIds: new Set([...state.enabledTabIds, tabId]),
      })),
      T.tapIO(() => this.logger.info(`Tab ${tabId} enabled`)),
    );

  /**
   * Disables HbbTV for a specific tab
   */
  readonly disableTab = (tabId: number): T.Task<void> =>
    pipe(
      this.updateState((state) => {
        const enabledTabIds = new Set(state.enabledTabIds);
        enabledTabIds.delete(tabId);
        return { ...state, enabledTabIds };
      }),
      T.tapIO(() => this.logger.info(`Tab ${tabId} disabled`)),
    );

  /**
   * Checks if a tab is enabled
   */
  readonly isTabEnabled = (tabId: number): IOE.IOEither<BackgroundServiceError, boolean> =>
    pipe(
      this.getState(),
      IOE.map((state) => state.enabledTabIds.has(tabId)),
    );

  /**
   * Gets all enabled tab IDs
   */
  readonly getEnabledTabs = (): IOE.IOEither<BackgroundServiceError, ReadonlySet<number>> =>
    pipe(
      this.getState(),
      IOE.map((state) => state.enabledTabIds),
    );

  // ===========================================================================
  // SETTINGS MANAGEMENT
  // ===========================================================================

  /**
   * Updates global settings
   */
  readonly updateSettings = (
    fn: (settings: ExtensionState["globalSettings"]) => ExtensionState["globalSettings"],
  ): T.Task<void> =>
    pipe(
      this.updateState((state) => ({
        ...state,
        globalSettings: fn(state.globalSettings),
      })),
      T.tapIO(() => this.logger.info("Global settings updated")),
    );
}
