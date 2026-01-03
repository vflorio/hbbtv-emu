/**
 * BackgroundService - Generic runtime for extension background script
 *
 * Orchestrates initialization, coordinates managers, and handles cross-component communication.
 */
import type { Logger } from "@hbb-emu/core";
import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as IOE from "fp-ts/IOEither";
import type * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type {
  BaseMessage,
  ForwardableMessage,
  ManifestVersion,
  MessagingAdapter,
  StorageAdapter,
  TabsAdapter,
  WebRequestAdapter,
} from "../..";
import {
  createMessagingAdapter,
  createStorageAdapter,
  createTabsAdapter,
  createWebRequestAdapter,
} from "../../adapters";
import type { BackgroundServiceError } from "./errors";
import { StateManager } from "./managers/state";
import { TabsManager } from "./managers/tabs";
import type { ExtensionState, GlobalSettings } from "./state";

// =============================================================================
// ENVIRONMENT & CONFIG
// =============================================================================

export type BackgroundServiceConfig = {
  readonly manifestVersion: ManifestVersion;
  readonly storageKey?: string;
  readonly env?: Partial<BackgroundServiceEnv>;
};

export type BackgroundServiceEnv = {
  readonly storage: StorageAdapter<ExtensionState>;
  readonly messaging: MessagingAdapter<ForwardableMessage>;
  readonly webRequest: WebRequestAdapter;
  readonly tabs: TabsAdapter;
};

export const createBackgroundServiceEnv = (
  manifestVersion: ManifestVersion,
  env?: Partial<BackgroundServiceEnv>,
): BackgroundServiceEnv => ({
  storage: env?.storage ?? createStorageAdapter(manifestVersion, "hbbtv_emu"),
  messaging: env?.messaging ?? createMessagingAdapter(manifestVersion),
  webRequest: env?.webRequest ?? createWebRequestAdapter(manifestVersion),
  tabs: env?.tabs ?? createTabsAdapter(manifestVersion),
});

// =============================================================================
// BACKGROUND SCRIPT CLASS
// =============================================================================

export class BackgroundService {
  private readonly logger: Logger;
  private readonly stateManager: StateManager;
  readonly tabsManager: TabsManager;

  private readonly messagingUnsubscribe: () => void;

  constructor(config: BackgroundServiceConfig, logger?: Logger) {
    this.logger = logger ?? createLogger("BackgroundService");

    const env = createBackgroundServiceEnv(config.manifestVersion, config.env);

    this.stateManager = new StateManager(
      {
        storage: env.storage,
      },
      createLogger("StateManager"),
    );

    this.tabsManager = new TabsManager(
      {
        tabs: env.tabs,
        webRequest: env.webRequest,
        onTabAdded: this.onTabAdded,
        onTabRemoved: this.onTabRemoved,
      },
      createLogger("TabsManager"),
    );

    this.messagingUnsubscribe = env.messaging.onMessage(this.onMessageReceived);
  }

  /**
   * Initializes all managers in sequence.
   * StateManager must be initialized before other components can access state.
   */
  readonly init = (): TE.TaskEither<BackgroundServiceError, void> =>
    pipe(
      TE.Do,
      TE.tapIO(() => this.logger.info("Initializing")),
      TE.flatMap(() => this.stateManager.init()),
      // TODO:
      TE.tapIO(() => this.logger.info("Initialized")),
    );

  /**
   * Cleanup resources
   */
  readonly destroy = (): IO.IO<void> =>
    pipe(
      IO.Do,
      IO.flatMap(() => this.logger.info("Destroying")),
      IO.flatMap(() => this.stateManager.destroy()),
      IO.flatMap(() => IO.of(this.messagingUnsubscribe)),
      IO.flatMap(() => this.logger.info("Destroyed")),
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
      this.logger.info(`Tab added: ${tabId}`),
    );

  /**
   * Handles tab removed event from TabsManager
   */
  private readonly onTabRemoved = (tabId: number): IO.IO<void> =>
    pipe(
      this.logger.info(`Tab removed: ${tabId}`),
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
      this.logger.debug(`Message received from tab ${tabId}`, message),
      // TODO: Route messages to appropriate handlers
    );
}
