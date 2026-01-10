/**
 * BackgroundService - Generic runtime for extension background script
 *
 * Orchestrates initialization, coordinates managers, and handles cross-component communication.
 */

import type { Logger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as IOE from "fp-ts/IOEither";
import type * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { AdapterError, BaseMessage } from "../..";
import type { CommonSettings, ExtensionState } from "../../state";
import type { ServiceEnv } from "..";
import { StateManager } from "./managers/state";
import { TabsManager } from "./managers/tabs";

//TODO
export type ForwardableMessage =
  | { readonly _tag: "Settings/Updated"; readonly settings: ExtensionState["common"] }
  | { readonly _tag: "Tab/StateChanged"; readonly tabId: number; readonly enabled: boolean }
  | { readonly _tag: "OIPF/RuntimeReady"; readonly tabId: number }
  | { readonly _tag: "UI/Opened"; readonly tabId: number }
  | { readonly _tag: "UI/Closed"; readonly tabId: number };

export type BackgroundServiceError = AdapterError | { readonly _tag: "StateNotInitialized" };

export class BackgroundService {
  private logger!: Logger;
  private readonly stateManager: StateManager;
  private tabsManager!: TabsManager;

  private messagingUnsubscribe?: () => void;

  constructor(protected readonly env: ServiceEnv<ExtensionState, ForwardableMessage>) {
    this.stateManager = new StateManager({
      storage: this.env.adapter.storage,
    });
  }

  readonly init = (): TE.TaskEither<BackgroundServiceError, void> =>
    pipe(
      TE.Do,
      TE.flatMap(() => this.stateManager.init()),
      TE.flatMapIOEither(() => this.stateManager.getState()),
      TE.tapIO((state) => () => {
        this.logger = this.env.logger.withConfig(state.logger).create("Background");
      }),
      TE.tapIO(() => this.stateManager.setLogger(this.logger)),
      TE.tapIO(() => this.logger.info("Initializing")),
      TE.tapIO(() => () => {
        this.tabsManager = new TabsManager({
          logger: this.logger,
          tabs: this.env.adapter.tabs,
          webRequest: this.env.adapter.webRequest,
          handlers: {
            onTabAdded: this.onTabAdded,
            onTabRemoved: this.onTabRemoved,
          },
        });
        this.messagingUnsubscribe = this.env.adapter.messaging.onMessage(this.onMessageReceived);
      }),
      TE.tapIO(() => this.logger.info("Initialized")),
      TE.asUnit,
    );

  readonly destroy = (): IO.IO<void> =>
    pipe(
      IO.Do,
      IO.flatMap(() => this.logger.info("Destroying")),
      IO.flatMap(() => this.stateManager.destroy()),
      IO.flatMap(() => () => {
        this.messagingUnsubscribe?.();
      }),
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
  readonly updateSettings = (fn: (settings: CommonSettings) => CommonSettings): T.Task<void> =>
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
