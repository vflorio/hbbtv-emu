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
  type WebRequestHandler,
  WithChromeMessageAdapter,
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithMessageBus,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as T from "fp-ts/Task";

const logger = createLogger("ServiceWorker");

const WithServiceWorker = <T extends ClassType<MessageAdapter & MessageBus & WebRequestHandler>>(Base: T) =>
  class extends Base implements App {
    store = new Storage<ExtensionConfig.State>("state");
    stateRef = IORef.newIORef(DEFAULT_HBBTV_CONFIG)();

    init = () => {
      pipe(
        this.store.load(),
        T.map(E.getOrElse(() => DEFAULT_HBBTV_CONFIG)),
        T.map((state) => this.stateRef.write(state)()),
        T.flatMap(() => T.fromIO(this.setupMessageHandlers)),
      )();
    };

    setupMessageHandlers: IO.IO<void> = () => {
      this.bus.on("CONTENT_SCRIPT_READY", () => {
        logger.log("Content script ready, sending config");
        this.broadcastConfig();
      });

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        logger.log("Updating config", payload);
        pipe(
          this.stateRef.write(payload),
          IO.flatMap(() => this.store.save(payload)),
          IO.flatMap(() => this.broadcastConfig),
        )();
      });
    };

    broadcastConfig: IO.IO<void> = () => {
      pipe(
        Array.from(this.tabs),
        A.traverse(IO.Applicative)((tabId) => () => {
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
        (io) => io(),
      );
    };
  };

// biome-ignore format: ack
const ServiceWorker = compose(
  class {}, 
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithChromeMessageAdapter, 
  WithMessageBus("SERVICE_WORKER"),
  WithServiceWorker
);

initApp(new ServiceWorker());
