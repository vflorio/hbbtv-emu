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

const WithBridge = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    init: IO.IO<void> = pipe(
      IO.of<void>(undefined),
      IO.tap(() => () => {
        this.registerMessageBus("BRIDGE_SCRIPT", this.forwardToContentScript);
        window.addEventListener("message", this.forwardToBackgroundScript);

        window.postMessage(
          createEnvelope(this.messageOrigin, "CONTENT_SCRIPT", { type: "BRIDGE_READY", payload: null }),
          "*",
        );
      }),
      IO.flatMap(() => logger.info("Initialized")),
    );

    forwardToContentScript = (envelope: MessageEnvelope) => {
      pipe(
        validateEnvelope(envelope),
        E.flatMap(validateTarget("CONTENT_SCRIPT")),
        E.match(
          () => {},
          (envelope) => {
            pipe(
              logger.info(`Forwarding ${envelope.source} → ${envelope.target}: ${envelope.message.type}`),
              IO.flatMap(() => () => window.postMessage(envelope, "*")),
            )();
          },
        ),
      );
    };

    forwardToBackgroundScript = (event: MessageEvent<MessageEnvelope>) => {
      pipe(
        validateEnvelope(event.data),
        E.flatMap(validateTarget("BACKGROUND_SCRIPT")),
        E.match(
          () => {},
          (envelope) => {
            pipe(
              logger.info(`Forwarding ${envelope.source} → ${envelope.target}: ${envelope.message.type}`),
              IO.flatMap(() => () => this.sendMessage(envelope)),
            )();
          },
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
