/**
 * BackgroundService - Generic runtime for extension background script
 *
 * Orchestrates initialization, coordinates managers, and handles cross-component communication.
 */

import type { Logger } from "@hbb-emu/core";
import {
  type HostMessage,
  isPageMessage,
  isUiRequest,
  type PageMessage,
  type StreamEventDescriptionResult,
} from "@hbb-emu/protocol";
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
  TV_PAGE,
  type TvSession,
  toBootstrapData,
  toPageConfig,
  toPageSession,
  tvPageUrl,
} from "../../state";
import type { ServiceEnv } from "..";
import { createPageBootstrap, type PageBootstrap } from "./bootstrap";
import { applicationChangesChannel, exitTabApplication, launchTabApplication } from "./channel";
import { StateManager } from "./managers/state";
import { TabsManager } from "./managers/tabs";
import { createSessions, type Sessions } from "./sessions";
import { handleUiRequest, notifyUis, pressTvKey, type UiEnv } from "./ui";

export type BackgroundServiceError = AdapterError | { readonly _tag: "StateNotInitialized" };

/** Why the TV could not fetch a resource, for the page's log. */
const describeFetchError = (error: AdapterError): string =>
  error._tag === "BroadbandFetchError" && error.cause instanceof Error ? error.cause.message : error._tag;

export class BackgroundService {
  private logger!: Logger;
  private readonly stateManager: StateManager;
  private pageBootstrap!: PageBootstrap;
  private sessions!: Sessions;
  private uiEnv!: UiEnv;
  tabsManager!: TabsManager;

  private messagingUnsubscribe?: () => void;
  private uiUnsubscribe?: () => void;

  /** Where the files the emulator ships are (the broadcast's test card), for the pages. */
  private readonly assetUrl = (path: string): string => this.env.adapter.assets.url(path);

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
      TE.tap((state) =>
        TE.fromTask(this.pageBootstrap.publish(toBootstrapData(state, this.sessions.all(), this.assetUrl))),
      ),
      TE.tapIO(() => () => {
        this.tabsManager = new TabsManager({
          logger: this.logger,
          tabs: this.env.adapter.tabs,
          webRequest: this.env.adapter.webRequest,
          handlers: {
            onTabRemoved: this.onTabRemoved,
            onActiveTabChanged: this.onActiveTabChanged,
          },
        });

        this.uiEnv = {
          stateManager: this.stateManager,
          messaging: this.env.adapter.messaging,
          tabs: this.env.adapter.tabs,
          ui: this.env.adapter.ui,
          userAgent: this.env.adapter.userAgent,
          pageBootstrap: this.pageBootstrap,
          sessions: this.sessions,
          tvPage: tvPageUrl(this.env.adapter.ui.pageUrl(TV_PAGE)),
          assetUrl: this.assetUrl,
          broadband: this.env.adapter.broadband,
          logger: this.logger,
        };

        this.messagingUnsubscribe = this.env.adapter.messaging.onMessage(this.onMessageReceived);
        this.uiUnsubscribe = this.env.adapter.ui.onRequest(isUiRequest, (request) =>
          handleUiRequest(request)(this.uiEnv),
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
          (state) => this.pageBootstrap.publish(toBootstrapData(state, this.sessions.all(), this.assetUrl)),
        ),
      ),
    );

  /** Every open UI shows the active tab's TV, whichever tab that is now. */
  private readonly showActiveTab = (): T.Task<void> =>
    pipe(
      T.fromIO(this.stateManager.getState()),
      T.flatMap(
        E.match(
          () => T.of(undefined),
          (state) => notifyUis(state)(this.uiEnv),
        ),
      ),
    );

  private readonly onActiveTabChanged: IO.IO<void> = () => {
    void this.showActiveTab()();
  };

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

  private readonly onPageMessage = (message: PageMessage, tabId: number): IO.IO<void> => {
    switch (message._tag) {
      case "Page/Ready":
        return this.onPageReady(message.url, tabId);
      case "Page/SetChannel":
        return this.onSetChannel(message.channelId, tabId);
      case "Page/TvKey":
        return this.onTvKey(message.keyCode, tabId);
      case "Page/FetchStreamEventDescription":
        return this.onFetchStreamEventDescription(message.url, tabId);
      case "Page/DestroyApplication":
        return this.onDestroyApplication(tabId);
      case "Page/CreateApplication":
        return this.onCreateApplication(message.url, tabId);
    }
  };

  /**
   * The application starts another (`createApplication()`): the TV of the tab loads it,
   * and the UIs show what it presents now; or the page hears why it cannot.
   */
  private readonly onCreateApplication = (url: string, tabId: number): IO.IO<void> =>
    pipe(
      this.logger.info(`The application in tab ${tabId} starts ${url}`),
      IO.flatMap(() => this.stateManager.getState()),
      IO.flatMap(
        E.match(
          (error) => this.logger.error("Cannot start the application", error),
          (state) => () => {
            void pipe(
              launchTabApplication(tabId, url, state)(this.uiEnv),
              TE.match(
                (reason) =>
                  pipe(
                    T.fromIO(this.logger.warn(`Tab ${tabId} cannot start ${url}: ${reason}`)),
                    T.flatMap(() =>
                      this.env.adapter.messaging.sendToTab(tabId, { _tag: "Host/ApplicationLoadError", url, reason }),
                    ),
                    T.asUnit,
                  ),
                () => notifyUis(state)(this.uiEnv),
              ),
              T.flatten,
            )();
          },
        ),
      ),
    );

  /**
   * The application exits (`destroyApplication()`): the TV of the tab loads what its
   * channel's AIT starts, maybe the same application (TS 102 796 §6.2.2.3), and the
   * UIs show it.
   */
  private readonly onDestroyApplication = (tabId: number): IO.IO<void> =>
    pipe(
      this.logger.info(`The application in tab ${tabId} exits`),
      IO.flatMap(() => this.stateManager.getState()),
      IO.flatMap(
        E.match(
          (error) => this.logger.error("Cannot stop the application", error),
          (state) => () => {
            void pipe(
              exitTabApplication(tabId, state)(this.uiEnv),
              TE.match(
                (error) => T.fromIO(this.logger.warn(`Could not stop the application in tab ${tabId}`, error)),
                (stopped) =>
                  stopped
                    ? notifyUis(state)(this.uiEnv)
                    : T.fromIO(
                        this.logger.warn(`Tab ${tabId} has no TV to start what comes next: the application runs on`),
                      ),
              ),
              T.flatten,
            )();
          },
        ),
      ),
    );

  /**
   * The application listens for stream events described over HTTP(S) (TS 102 796
   * §8.2.1.1): the TV fetches the description, without CORS, and the page reads it.
   */
  private readonly onFetchStreamEventDescription =
    (url: string, tabId: number): IO.IO<void> =>
    () => {
      void pipe(
        this.env.adapter.broadband.fetchText(url),
        TE.match(
          (error): StreamEventDescriptionResult => ({ ok: false, reason: describeFetchError(error) }),
          ({ contentType, body }): StreamEventDescriptionResult => ({ ok: true, contentType, body }),
        ),
        T.tapIO((result) =>
          result.ok ? IO.of(undefined) : this.logger.warn(`Tab ${tabId} cannot have ${url}: ${result.reason}`),
        ),
        T.flatMap((result) =>
          this.env.adapter.messaging.sendToTab(tabId, { _tag: "Host/StreamEventDescription", url, result }),
        ),
        TE.orElseFirstIOK((error) => this.logger.warn(`Could not answer tab ${tabId} about ${url}`, error)),
      )();
    };

  /** P+/P- or VOL+/VOL- pressed on the keyboard in the page: the TV in that tab acts on it. */
  private readonly onTvKey =
    (keyCode: number, tabId: number): IO.IO<void> =>
    () => {
      void pipe(
        pressTvKey(tabId, keyCode)(this.uiEnv),
        T.flatMap((response) =>
          T.fromIO(
            response._tag === "UI/Failed"
              ? this.logger.warn(`Key ${keyCode} in tab ${tabId}: ${response.reason}`)
              : IO.of(undefined),
          ),
        ),
      )();
    };

  /**
   * A page runtime started in a tab: send it the configuration, then the tab's TV
   * session (opened now if this is the first HbbTV page of the tab), which now shows
   * this page. Object state is never pushed here (ROADMAP D5).
   */
  private readonly onPageReady = (url: string, tabId: number): IO.IO<void> =>
    pipe(
      this.logger.info(`Page runtime ready in tab ${tabId}: ${url}`),
      IO.flatMap(() => this.stateManager.getState()),
      IO.flatMap(
        E.match(
          (error) => this.logger.error("Cannot configure the page runtime", error),
          (state) => () => {
            void pipe(
              this.env.adapter.messaging.sendToTab(tabId, {
                _tag: "Host/Config",
                config: toPageConfig(state, this.assetUrl),
              }),
              TE.flatMap(() => TE.fromTask(this.showing(tabId, url, state))),
              TE.flatMap((session) =>
                this.env.adapter.messaging.sendToTab(tabId, {
                  _tag: "Host/Session",
                  session: toPageSession(state, session, this.assetUrl),
                }),
              ),
              TE.orElseFirstIOK((error) => this.logger.warn(`Could not configure the page in tab ${tabId}`, error)),
              // A reload of this page will find its channel at document_start. And if this
              // page got its data late, the bootstrap may have become possible since.
              TE.tap(() => TE.fromTask(this.republish())),
              // The tab may now be a TV, or show another channel: the UIs follow.
              TE.tap(() => TE.fromTask(this.showActiveTab())),
            )();
          },
        ),
      ),
    );

  /**
   * The application asks to change channel (`setChannel()`): the TV changes as it
   * does from the UI, and the UIs show it. If it does not, the page gets the error.
   */
  private readonly onSetChannel = (channelId: string, tabId: number): IO.IO<void> =>
    pipe(
      this.logger.info(`The application in tab ${tabId} asks for channel ${channelId}`),
      IO.flatMap(() => this.stateManager.getState()),
      IO.flatMap(
        E.match(
          (error) => this.logger.error("Cannot change channel", error),
          (state) => () => {
            void pipe(
              applicationChangesChannel(tabId, channelId, state)(this.uiEnv),
              TE.match(
                (refusal) =>
                  pipe(
                    T.fromIO(this.logger.warn(`Tab ${tabId} stays on its channel: ${refusal.reason}`)),
                    T.flatMap(() =>
                      this.env.adapter.messaging.sendToTab(tabId, {
                        _tag: "Host/ChannelChangeError",
                        channelId,
                        error: refusal.error,
                      }),
                    ),
                    T.asUnit,
                  ),
                () => notifyUis(state)(this.uiEnv),
              ),
              T.flatten,
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
