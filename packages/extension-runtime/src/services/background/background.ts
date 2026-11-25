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
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { AdapterError, BaseMessage } from "../..";
import {
  type ExtensionState,
  newSession,
  type TvSession,
  toBootstrapData,
  toPageConfig,
  toPageSession,
} from "../../state";
import type { ServiceEnv } from "..";
import { createPageBootstrap, type PageBootstrap } from "./bootstrap";
import { StateManager } from "./managers/state";
import { TabsManager } from "./managers/tabs";
import { createSessions, type Sessions } from "./sessions";
import { handleUiRequest } from "./ui";

export type BackgroundServiceError = AdapterError | { readonly _tag: "StateNotInitialized" };

export class BackgroundService {
  private logger!: Logger;
  private readonly stateManager: StateManager;
  private pageBootstrap!: PageBootstrap;
  private sessions!: Sessions;
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
      // Before any page loads: the TV's user agent on every HTTP request.
      TE.tap((state) =>
        pipe(
          this.env.adapter.userAgent.setUserAgent(state.runtime.userAgent),
          TE.orElseFirstIOK((error) => this.logger.error("Could not set the HTTP user agent", error)),
          TE.orElse(() => TE.right<BackgroundServiceError, void>(undefined)),
        ),
      ),
      // The TV sessions of a stopped service worker, minus the tabs closed meanwhile.
      TE.tapIO(() => () => {
        this.sessions = createSessions(this.env.adapter.sessionStorage, this.logger);
      }),
      TE.tap(() =>
        TE.fromTask(
          pipe(
            this.env.adapter.tabs.query({}),
            T.flatMap((tabs) => this.sessions.load(tabs.map((tab) => tab.id))),
          ),
        ),
      ),
      // Also before any page loads: what pages find at document_start.
      TE.tapIO(() => () => {
        this.pageBootstrap = createPageBootstrap(this.env.adapter.pageBootstrap, this.logger);
      }),
      TE.tap((state) => TE.fromTask(this.pageBootstrap.publish(toBootstrapData(state, this.sessions.all())))),
      TE.tapIO(() => () => {
        this.tabsManager = new TabsManager({
          logger: this.logger,
          tabs: this.env.adapter.tabs,
          webRequest: this.env.adapter.webRequest,
          handlers: {
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
            userAgent: this.env.adapter.userAgent,
            pageBootstrap: this.pageBootstrap,
            sessions: this.sessions,
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

  /** Pages loaded from now on get the current configuration and tunings. */
  private readonly republish = (): T.Task<void> =>
    pipe(
      T.fromIO(this.stateManager.getState()),
      T.flatMap(
        E.match(
          () => T.of(undefined),
          (state) => this.pageBootstrap.publish(toBootstrapData(state, this.sessions.all())),
        ),
      ),
    );

  /** The TV in that tab is gone, and so is its tuning. */
  private readonly onTabRemoved =
    (tabId: number): IO.IO<void> =>
    () => {
      void pipe(this.sessions.close(tabId), T.flatMap(this.republish))();
    };

  /**
   * Handles messages from other extension scripts
   */
  private readonly onMessageReceived = (message: BaseMessage, tabId: number): IO.IO<void> =>
    pipe(
      this.logger.debug(`Message received from tab ${tabId}`, message),
      IO.flatMap(() => (isPageMessage(message) ? this.onPageMessage(message, tabId) : IO.of(undefined))),
    );

  /**
   * A page runtime started in a tab: send it the configuration, then the tab's TV
   * session (opened now if this is the first HbbTV page of the tab), which now shows
   * this page. Object state is never pushed here (ROADMAP D5).
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
              TE.flatMap(() => TE.fromTask(this.showing(tabId, message.url, state))),
              TE.flatMap((session) =>
                this.env.adapter.messaging.sendToTab(tabId, {
                  _tag: "Host/Session",
                  session: toPageSession(state, session),
                }),
              ),
              TE.orElseFirstIOK((error) => this.logger.warn(`Could not configure the page in tab ${tabId}`, error)),
              // A reload of this page will find its channel at document_start. And if this
              // page got its data late, the bootstrap may have become possible since.
              TE.tap(() => TE.fromTask(this.republish())),
            )();
          },
        ),
      ),
    );

  /** The tab's TV session, opened if needed, now showing `url`. */
  private readonly showing = (tabId: number, url: string, state: ExtensionState): T.Task<TvSession> =>
    pipe(
      this.sessions.open(tabId, newSession(state, this.sessions.all(), url)),
      T.flatMap((session) =>
        session.url === url
          ? T.of(session)
          : pipe(
              this.sessions.update(tabId, (current) => ({ ...current, url })),
              T.map(O.getOrElse(() => session)),
            ),
      ),
    );
}
