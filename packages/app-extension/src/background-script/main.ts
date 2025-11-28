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
import { WithChromeScriptInject } from "./chromeScriptInject";
import { type UserAgentManager, WithChromeUserAgentManager } from "./chromeUserAgentManager";
import { type WebRequestHandler, WithChromeWebRequestManager } from "./chromeWebRequestManager";

const logger = createLogger("BackgroundScript");

const WithBackgroundScript = <T extends ClassType<MessageAdapter & MessageBus & WebRequestHandler & UserAgentManager>>(
  Base: T,
) =>
  class extends Base implements App {
    store = new Storage<ExtensionConfig.State>("state");
    stateRef = IORef.newIORef(DEFAULT_HBBTV_CONFIG)();

    init: IO.IO<void> = () => {
      pipe(
        this.store.load(),
        T.map(E.getOrElse(() => DEFAULT_HBBTV_CONFIG)),
        T.map((state) => this.stateRef.write(state)),
        T.flatMap(() => T.fromIO(this.setupMessageHandlers)),
      )();
    };

    setupMessageHandlers = IO.of(() => {
      this.bus.on("CONTENT_SCRIPT_READY", () => {
        logger.log("Content script ready, sending config");
        this.broadcastConfig();
      });

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        logger.log("Updating config", payload);
        pipe(
          this.stateRef.write(payload),
          IO.flatMap(() => this.store.save(payload)),
          IO.flatMap(() => this.updateUserAgent(payload.userAgent)),
          IO.flatMap(() => this.broadcastConfig),
        )();
      });

      this.bus.on("UPDATE_USER_AGENT", ({ message: { payload } }) => {
        logger.log("Updating user agent", payload);
        const currentState = this.stateRef.read();
        pipe(
          this.stateRef.write({ ...currentState, userAgent: payload }),
          IO.flatMap(() => this.store.save({ ...currentState, userAgent: payload })),
          IO.flatMap(() => this.updateUserAgent(payload)),
          IO.flatMap(() => this.broadcastConfig),
        )();
      });
    });

    broadcastConfig = IO.of(() =>
      pipe(
        Array.from(this.tabs),
        A.traverse(IO.Applicative)((tabId) =>
          IO.of(() => {
            this.sendMessage(
              createEnvelope(
                this.messageOrigin,
                "CONTENT_SCRIPT",
                { type: "UPDATE_CONFIG", payload: this.stateRef.read() },
                { tabId },
              ),
            );
            logger.log(`Config sent to tab ${tabId}`);
          }),
        ),
        IO.map(() => undefined),
      )(),
    );
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
