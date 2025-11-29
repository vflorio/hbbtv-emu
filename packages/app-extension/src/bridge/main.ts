import {
  type App,
  type ClassType,
  compose,
  createEnvelope,
  createLogger,
  initApp,
  type MessageAdapter,
  type MessageBus,
  type MessageEnvelope,
  validateEnvelope,
  validateTarget,
  WithChromeMessageAdapter,
  WithMessageBus,
} from "@hbb-emu/lib";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

const logger = createLogger("BridgeScript");

const logForwardedMessage = (envelope: MessageEnvelope): IO.IO<void> =>
  logger.info(`Forwarded ${envelope.source} → ${envelope.target}: ${envelope.message.type}`);

const WithBridge = <T extends ClassType<MessageAdapter.Contract & MessageBus.Contract>>(Base: T) =>
  class extends Base implements App {
    init: IO.IO<void> = pipe(
      logger.info("Initializing"),
      IO.tap(() => this.registerMessageHandler("BRIDGE_SCRIPT", this.forwardToContentScript)),
      IO.tap(() => this.setupEventListener),
      IO.tap(() => logger.info("Initialized")),
    );

    setupEventListener: IO.IO<void> = () => {
      window.addEventListener("message", this.forwardToBackgroundScript);
      window.postMessage(
        createEnvelope(this.messageOrigin, "CONTENT_SCRIPT", { type: "BRIDGE_READY", payload: null }),
        "*",
      );
    };

    forwardToContentScript = (envelope: MessageEnvelope) => {
      pipe(
        validateEnvelope(envelope),
        E.flatMap(validateTarget("CONTENT_SCRIPT")),
        E.match(
          () => {},
          (envelope) =>
            pipe(
              logForwardedMessage(envelope),
              IO.tap(() => () => window.postMessage(envelope, "*")),
            )(),
        ),
      );
    };

    forwardToBackgroundScript = (event: MessageEvent<MessageEnvelope>) => {
      pipe(
        validateEnvelope(event.data),
        E.flatMap(validateTarget("BACKGROUND_SCRIPT")),
        E.match(
          () => {},
          (envelope) =>
            pipe(
              logForwardedMessage(envelope),
              IO.tap(() => this.sendMessage(envelope)),
            )(),
        ),
      );
    };
  };

// biome-ignore format: ack
const BridgeScript = compose(
  class { },
  WithChromeMessageAdapter,
  WithMessageBus("BRIDGE_SCRIPT"),
  WithBridge
);

initApp(new BridgeScript())();
