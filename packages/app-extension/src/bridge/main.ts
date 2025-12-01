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
import { addEventListener } from "fp-ts-std/DOM";

const logger = createLogger("BridgeScript");

const logForwardedMessage = (envelope: MessageEnvelope): IO.IO<void> =>
  logger.info(`Forwarded ${envelope.source} → ${envelope.target}: ${envelope.message.type}`);

const postMessage =
  (envelope: MessageEnvelope): IO.IO<void> =>
  () =>
    window.postMessage(envelope, "*");

const isMessageEvent = (event: any): event is MessageEvent =>
  event && typeof event === "object" && "data" in event && typeof event.data === "object";

const WithBridge = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    init: IO.IO<void> = pipe(
      logger.info("Initializing"),
      IO.tap(() => addEventListener("message")(this.forwardToBackgroundScript)(window)),
      IO.tap(() => this.subscribe),
      IO.tap(() =>
        pipe(
          this.messageOrigin.read,
          IO.map((origin) => createEnvelope(origin, "CONTENT_SCRIPT", { type: "BRIDGE_READY", payload: null })),
          IO.flatMap((envelope) => postMessage(envelope)),
        ),
      ),
      IO.tap(() => logger.info("Initialized")),
    );

    subscribe: IO.IO<void> = () => {
      this.bus.on("UPDATE_CONFIG", (envelope) =>
        pipe(
          logForwardedMessage(envelope),
          IO.flatMap(() => postMessage(envelope)),
        ),
      );
    };

    forwardToBackgroundScript =
      (event: Event): IO.IO<void> =>
      () =>
        pipe(
          IO.of(isMessageEvent(event) ? event.data : undefined),
          validateEnvelope,
          E.flatMap(validateTarget("BACKGROUND_SCRIPT")),
          E.match(IO.of(undefined), (envelope) =>
            pipe(
              logForwardedMessage(envelope),
              IO.flatMap(() => this.sendMessage(envelope)),
            ),
          ),
        );
  };

// biome-ignore format: ack
const BridgeScript = compose(
  class { },
  WithChromeMessageAdapter,
  WithMessageBus("BRIDGE_SCRIPT"),
  WithBridge
);

initApp(new BridgeScript())();
