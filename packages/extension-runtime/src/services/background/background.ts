/**
 * BackgroundService - Generic runtime for extension background script
 *
 * Orchestrates initialization, coordinates managers, and handles cross-component communication.
 */

import type { Logger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import type { AdapterError, BaseMessage } from "../..";
import type { ExtensionState } from "../../state";
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
  tabsManager!: TabsManager;

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
          stateManager: this.stateManager,
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
  private readonly onTabRemoved = (tabId: number): IO.IO<void> => pipe(this.logger.info(`Tab removed: ${tabId}`));

  /**
   * Handles messages from other extension scripts
   */
  private readonly onMessageReceived = (message: BaseMessage, tabId: number): IO.IO<void> =>
    pipe(
      this.logger.debug(`Message received from tab ${tabId}`, message),
      // TODO: Route messages to appropriate handlers
    );
}
