/**
 * BackgroundService - Generic runtime for extension background script
 *
 * Orchestrates initialization, coordinates managers, and handles cross-component communication.
 */

import type { Logger } from "@hbb-emu/core";
import { type HostMessage, isPageMessage, isUiRequest, type PageMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import type { AdapterError, BaseMessage } from "../..";
import { type ExtensionState, toPageConfig } from "../../state";
import type { ServiceEnv } from "..";
import { StateManager } from "./managers/state";
import { TabsManager } from "./managers/tabs";
import { handleUiRequest } from "./ui";

export type BackgroundServiceError = AdapterError | { readonly _tag: "StateNotInitialized" };

export class BackgroundService {
  private logger!: Logger;
  private readonly stateManager: StateManager;
  tabsManager!: TabsManager;

  private messagingUnsubscribe?: () => void;
  private uiUnsubscribe?: () => void;

  constructor(protected readonly env: ServiceEnv<ExtensionState, HostMessage>) {
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
        this.uiUnsubscribe = this.env.adapter.ui.onRequest(isUiRequest, (request) =>
          handleUiRequest(request)({
            stateManager: this.stateManager,
            messaging: this.env.adapter.messaging,
            tabs: this.env.adapter.tabs,
            ui: this.env.adapter.ui,
            logger: this.logger,
          }),
        );
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
        this.uiUnsubscribe?.();
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
      IO.flatMap(() => (isPageMessage(message) ? this.onPageMessage(message, tabId) : IO.of(undefined))),
    );

  /**
   * A page runtime started in a tab: send it the configuration.
   * Object state is never pushed here (ROADMAP D5).
   */
  private readonly onPageMessage = (message: PageMessage, tabId: number): IO.IO<void> =>
    pipe(
      this.logger.info(`Page runtime ready in tab ${tabId}: ${message.url}`),
      IO.flatMap(() => this.stateManager.getState()),
      IO.flatMap(
        E.match(
          (error) => this.logger.error("Cannot configure the page runtime", error),
          (state) => () => {
            void pipe(
              this.env.adapter.messaging.sendToTab(tabId, { _tag: "Host/Config", config: toPageConfig(state) }),
              TE.orElseFirstIOK((error) => this.logger.warn(`Could not send the configuration to tab ${tabId}`, error)),
            )();
          },
        ),
      ),
    );
}
