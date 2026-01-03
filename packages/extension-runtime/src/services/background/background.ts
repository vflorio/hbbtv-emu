/**
 * BackgroundService - Generic runtime for extension background script
 *
 * Orchestrates initialization, coordinates managers, and handles cross-component communication.
 */
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as IOE from "fp-ts/IOEither";
import type * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { AdapterError, BaseMessage } from "../..";
import type { ServiceEnv } from "..";
import { StateManager } from "./managers/state";
import { TabsManager } from "./managers/tabs";
import type { ExtensionState, GlobalSettings } from "./state";

//TODO
export type ForwardableMessage =
  | { readonly _tag: "Settings/Updated"; readonly settings: ExtensionState["globalSettings"] }
  | { readonly _tag: "Tab/StateChanged"; readonly tabId: number; readonly enabled: boolean }
  | { readonly _tag: "OIPF/RuntimeReady"; readonly tabId: number }
  | { readonly _tag: "UI/Opened"; readonly tabId: number }
  | { readonly _tag: "UI/Closed"; readonly tabId: number };

export type BackgroundServiceError = AdapterError | { readonly _tag: "StateNotInitialized" };

export class BackgroundService {
  private readonly stateManager: StateManager;
  readonly tabsManager: TabsManager;

  private readonly messagingUnsubscribe: () => void;

  constructor(protected readonly env: ServiceEnv<ExtensionState, ForwardableMessage>) {
    this.stateManager = new StateManager({
      logger: this.env.logger,
      storage: this.env.adapter.storage,
    });

    this.tabsManager = new TabsManager({
      logger: this.env.logger,
      tabs: this.env.adapter.tabs,
      webRequest: this.env.adapter.webRequest,
      onTabAdded: this.onTabAdded,
      onTabRemoved: this.onTabRemoved,
    });

    this.messagingUnsubscribe = this.env.adapter.messaging.onMessage(this.onMessageReceived);
  }

  /**
   * Initializes all managers in sequence.
   * StateManager must be initialized before other components can access state.
   */
  readonly init = (): TE.TaskEither<BackgroundServiceError, void> =>
    pipe(
      TE.Do,
      TE.tapIO(() => this.env.logger.info("Initializing")),
      TE.flatMap(() => this.stateManager.init()),
      // TODO:
      TE.tapIO(() => this.env.logger.info("Initialized")),
    );

  /**
   * Cleanup resources
   */
  readonly destroy = (): IO.IO<void> =>
    pipe(
      IO.Do,
      IO.flatMap(() => this.env.logger.info("Destroying")),
      IO.flatMap(() => this.stateManager.destroy()),
      IO.flatMap(() => IO.of(this.messagingUnsubscribe)),
      IO.flatMap(() => this.env.logger.info("Destroyed")),
    );

  // ===========================================================================
  // STATE DELEGATION
  // ===========================================================================

  /**
   * Returns current state. Delegates to StateManager.
   */
  readonly getState = (): IOE.IOEither<BackgroundServiceError, ExtensionState> => this.stateManager.getState();

  /**
   * Returns whether the background script is initialized
   */
  readonly isInitialized = (): IO.IO<boolean> => this.stateManager.isInitialized();

  // ===========================================================================
  // TAB MANAGEMENT DELEGATION
  // ===========================================================================

  /**
   * Enables HbbTV for a specific tab. Delegates to StateManager.
   */
  readonly enableTab = (tabId: number): T.Task<void> => this.stateManager.enableTab(tabId);

  /**
   * Disables HbbTV for a specific tab. Delegates to StateManager.
   */
  readonly disableTab = (tabId: number): T.Task<void> => this.stateManager.disableTab(tabId);

  /**
   * Checks if a tab is enabled. Delegates to StateManager.
   */
  readonly isTabEnabled = (tabId: number): IOE.IOEither<BackgroundServiceError, boolean> =>
    this.stateManager.isTabEnabled(tabId);

  /**
   * Gets all enabled tab IDs. Delegates to StateManager.
   */
  readonly getEnabledTabs = (): IOE.IOEither<BackgroundServiceError, ReadonlySet<number>> =>
    this.stateManager.getEnabledTabs();

  // ===========================================================================
  // SETTINGS MANAGEMENT DELEGATION
  // ===========================================================================

  /**
   * Updates global settings. Delegates to StateManager.
   */
  readonly updateSettings = (fn: (settings: GlobalSettings) => GlobalSettings): T.Task<void> =>
    this.stateManager.updateSettings(fn);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handles tab added event from TabsManager
   */
  private readonly onTabAdded = (tabId: number): IO.IO<void> =>
    pipe(
      // TODO
      this.env.logger.info(`Tab added: ${tabId}`),
    );

  /**
   * Handles tab removed event from TabsManager
   */
  private readonly onTabRemoved = (tabId: number): IO.IO<void> =>
    pipe(
      this.env.logger.info(`Tab removed: ${tabId}`),
      IO.tap(() => () => {
        // Clean up tab state asynchronously through StateManager
        this.stateManager.disableTab(tabId)();
      }),
    );

  /**
   * Handles messages from other extension scripts
   */
  private readonly onMessageReceived = (message: BaseMessage, tabId: number): IO.IO<void> =>
    pipe(
      this.env.logger.debug(`Message received from tab ${tabId}`, message),
      // TODO: Route messages to appropriate handlers
    );
}
