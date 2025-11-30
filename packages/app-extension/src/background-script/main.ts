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
  Storage,
  WithChromeMessageAdapter,
  WithMessageBus,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { WithChromeScriptInject } from "./chromeScriptInject";
import { type UserAgentManager, WithChromeUserAgentManager } from "./chromeUserAgentManager";
import { type WebRequestHandler, WithChromeWebRequestManager } from "./chromeWebRequestManager";

const logger = createLogger("BackgroundScript");

const WithBackgroundScript = <
  T extends ClassType<
    MessageAdapter.Contract & MessageBus.Contract & WebRequestHandler.Contract & UserAgentManager.Contract
  >,
>(
  Base: T,
) =>
  class extends Base implements App {
    store = new Storage<ExtensionConfig.State>("state");
    stateRef = IORef.newIORef<ExtensionConfig.State>(DEFAULT_HBBTV_CONFIG)();

    init: IO.IO<void> = pipe(
      this.store.load(),
      T.map(E.getOrElse(() => DEFAULT_HBBTV_CONFIG)),
      T.map((state) => this.stateRef.write(state)),
      T.tapIO(() => this.setupMessageHandlers),
    );

    setupMessageHandlers: IO.IO<void> = () => {
      this.bus.on(
        "CONTENT_SCRIPT_READY",
        pipe(
          logger.info("Content script ready, sending config"),
          IO.tap(() => this.notify),
        ),
      );

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) =>
        pipe(
          logger.info("Updating config", payload),
          IO.tap(() => this.stateRef.write(payload)),
          IO.tap(() => this.store.save(payload)),
          IO.tap(() => this.notify),
        ),
      );

      this.bus.on("UPDATE_USER_AGENT", ({ message: { payload } }) =>
        pipe(
          logger.info("Updating user agent", payload),
          IO.bind("currentState", () => IO.of(this.stateRef.read())),
          IO.tap(({ currentState }) => this.stateRef.write({ ...currentState, userAgent: payload })),
          IO.tap(({ currentState }) => this.store.save({ ...currentState, userAgent: payload })),
          IO.tap(() => this.updateUserAgent(payload)),
        ),
      );
    };

    sendToTab = (tabId: number): IO.IO<void> =>
      pipe(
        IO.of(
          createEnvelope(
            this.messageOrigin,
            "CONTENT_SCRIPT",
            { type: "UPDATE_CONFIG", payload: this.stateRef.read() },
            { tabId },
          ),
        ),
        IO.flatMap((envelope) =>
          pipe(
            this.sendMessage(envelope),
            TE.match(IO.of(undefined), () => logger.info(`Config sent to tab ${tabId}`)),
          ),
        ),
      );

    notify: IO.IO<void> = pipe(Array.from(this.tabs), A.traverse(IO.Applicative)(this.sendToTab));
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
