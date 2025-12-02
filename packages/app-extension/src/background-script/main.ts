import {
  type App,
  type ClassType,
  compose,
  createEnvelope,
  createLogger,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionConfig,
  initApp,
  type MessageAdapter,
  type MessageBus,
  type MessageOrigin,
  Storage,
  WithChromeMessageAdapter,
  WithMessageBus,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { WithChromeScriptInject } from "./chromeScriptInject";
import { type UserAgentManager, WithChromeUserAgentManager } from "./chromeUserAgentManager";
import { type WebRequestHandler, WithChromeWebRequestManager } from "./chromeWebRequestManager";

const logger = createLogger("BackgroundScript");

const WithBackgroundScript = <T extends ClassType<MessageAdapter & MessageBus & WebRequestHandler & UserAgentManager>>(
  Base: T,
) =>
  class extends Base implements App {
    store = new Storage<ExtensionConfig.State>("state");
    stateRef = IORef.newIORef<ExtensionConfig.State>(DEFAULT_HBBTV_CONFIG)();

    init: IO.IO<void> = () =>
      pipe(
        this.store.load(),
        TE.getOrElse(() => T.of(DEFAULT_HBBTV_CONFIG)),
        T.flatMap((state) => T.fromIO(this.stateRef.write(state))),
        T.tapIO(() => this.subscribe),
      )();

    subscribe: IO.IO<void> = () => {
      this.bus.on("CONTENT_SCRIPT_READY", (envelope) =>
        pipe(
          logger.info(`Content script ready from tab ${envelope.context?.tabId}`),
          IO.tap(() => () => {
            if (envelope.context?.tabId) {
              this.tabs.add(envelope.context.tabId);
              logger.info(`Tab ${envelope.context.tabId} added to tabs set`)();
            }
          }),
          IO.flatMap(() => () => this.notifyTabs()),
        ),
      );

      this.bus.on("GET_CONFIG", (envelope) =>
        pipe(
          logger.info(`Get config request from ${envelope.source}, tabId: ${envelope.context?.tabId}`),
          IO.flatMap(() => () => {
            const tabId = envelope.context?.tabId;
            if (tabId) {
              // Request from content script - respond to specific tab
              this.tabs.add(tabId);
              this.sendToTab(tabId)();
            } else {
              // Request from side panel or other extension context
              this.sendConfigTo(envelope.source)();
            }
          }),
        ),
      );

      this.bus.on("UPDATE_CONFIG", (envelope) =>
        pipe(
          logger.info("Updating config", envelope.message.payload),
          IO.tap(() => this.stateRef.write(envelope.message.payload)),
          IO.flatMap(
            () => () =>
              pipe(
                this.store.save(envelope.message.payload),
                TE.match(
                  (error) => logger.error("Failed to save config", error)(),
                  () => logger.info("Config saved")(),
                ),
                T.flatMap(() => this.notifyTabs),
                T.flatMap(() => this.sendConfigTo(envelope.source)),
              )(),
          ),
        ),
      );

      this.bus.on("UPDATE_USER_AGENT", (envelope) =>
        pipe(
          logger.info("Updating user agent", envelope.message.payload),
          IO.bind("currentState", () => this.stateRef.read),
          IO.tap(({ currentState }) => this.stateRef.write({ ...currentState, userAgent: envelope.message.payload })),
          IO.flatMap(
            ({ currentState }) =>
              () =>
                pipe(
                  this.store.save({ ...currentState, userAgent: envelope.message.payload }),
                  TE.match(
                    (error) => logger.error("Failed to save config", error)(),
                    () => logger.info("Config saved")(),
                  ),
                )(),
          ),
          IO.tap(() => this.updateUserAgent(envelope.message.payload)),
        ),
      );
    };

    sendConfigTo = (target: MessageOrigin): T.Task<void> =>
      pipe(
        T.fromIO(this.messageOrigin.read),
        T.bindTo("messageOrigin"),
        T.bind("state", () => T.fromIO(this.stateRef.read)),
        T.map(({ messageOrigin, state }) =>
          createEnvelope(messageOrigin, target, { type: "UPDATE_CONFIG", payload: state }),
        ),
        T.flatMap((envelope) =>
          pipe(
            this.sendMessage(envelope),
            TE.match(
              () => logger.info(`Failed to send config to ${target}`)(),
              () => logger.info(`Config sent to ${target}`)(),
            ),
          ),
        ),
      );

    sendToTab = (tabId: number): T.Task<void> =>
      pipe(
        T.fromIO(this.messageOrigin.read),
        T.bindTo("messageOrigin"),
        T.bind("state", () => T.fromIO(this.stateRef.read)),
        T.map(({ messageOrigin, state }) =>
          createEnvelope(messageOrigin, "CONTENT_SCRIPT", { type: "UPDATE_CONFIG", payload: state }, { tabId }),
        ),
        T.flatMap((envelope) =>
          pipe(
            this.sendMessage(envelope),
            TE.match(
              () => logger.info(`Failed to send config to tab ${tabId}`)(),
              () => logger.info(`Config sent to tab ${tabId}`)(),
            ),
          ),
        ),
      );

    notifyTabs: T.Task<void> = () =>
      pipe(
        Array.from(this.tabs),
        (tabs) => {
          logger.info(`Notifying ${tabs.length} tabs: ${tabs.join(", ")}`)();
          return tabs;
        },
        A.traverse(T.ApplicativeSeq)(this.sendToTab),
        T.map(() => undefined),
      )();

    notify: IO.IO<void> = () => this.notifyTabs();
  };

// biome-ignore format: ack
const BackgroundScript = compose(
  class {}, 
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithChromeUserAgentManager,
  WithChromeMessageAdapter, 
  WithMessageBus("BACKGROUND_SCRIPT"),
  WithBackgroundScript
);

initApp(new BackgroundScript())();
