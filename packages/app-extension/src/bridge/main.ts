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

import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

const logger = createLogger("BridgeScript");

const WithBridge = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    init = () => {
      this.registerMessageBus("BRIDGE_SCRIPT", this.forwardToContentScript);
      window.addEventListener("message", this.forwardToServiceWorker);

      window.postMessage(
        createEnvelope(this.messageOrigin, "CONTENT_SCRIPT", { type: "BRIDGE_READY", payload: null }),
        "*",
      );

      logger.log("Initialized");
    };

    forwardToContentScript = (envelope: MessageEnvelope) => {
      pipe(
        validateEnvelope(envelope),
        O.tap(validateTarget("CONTENT_SCRIPT")),
        O.match(
          () => IO.of(undefined),
          (envelope): IO.IO<void> =>
            () => {
              logger.log(`Forwarding ${envelope.source} → ${envelope.target}: ${envelope.message.type}`);
              window.postMessage(envelope, "*");
            },
        ),
      )();
    };

    forwardToServiceWorker = (event: MessageEvent<MessageEnvelope>) => {
      pipe(
        validateEnvelope(event.data),
        O.flatMap(validateTarget("SERVICE_WORKER")),
        O.match(
          () => IO.of(undefined),
          (envelope): IO.IO<void> =>
            () => {
              logger.log(`Forwarding ${envelope.source} → ${envelope.target}: ${envelope.message.type}`);
              this.sendMessage(envelope);
            },
        ),
      )();
    };
  };

// biome-ignore format: ack
const BridgeScript = compose(
  class {},
  WithChromeMessageAdapter,
  WithMessageBus("BRIDGE_SCRIPT"),
  WithBridge
);

initApp(new BridgeScript());
