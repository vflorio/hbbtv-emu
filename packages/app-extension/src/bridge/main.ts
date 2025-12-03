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

const logForwardedMessage = (envelope: MessageEnvelope): IO.IO<void> => IO.Do;
//logger.info(`Forwarded ${envelope.source} → ${envelope.target}: ${envelope.message.type}`);

const postMessage =
  (envelope: MessageEnvelope): IO.IO<void> =>
  () =>
    window.postMessage(envelope, "*");

const isMessageEvent = (event: any): event is MessageEvent =>
  event && typeof event === "object" && "data" in event && typeof event.data === "object";

// Message types to forward from background to content script
const FORWARD_TO_CONTENT_SCRIPT = ["UPDATE_CONFIG", "DISPATCH_STREAM_EVENT"];

const WithBridge = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    init: IO.IO<void> = pipe(
      logger.info("Initializing"),
      IO.tap(() => () => window.addEventListener("message", this.forwardToBackgroundScript)),
      IO.tap(() => this.setupForwarding),
      IO.tap(() =>
        pipe(
          this.messageOrigin.read,
          IO.map((origin) => createEnvelope(origin, "CONTENT_SCRIPT", { type: "BRIDGE_READY", payload: null })),
          IO.flatMap((envelope) => postMessage(envelope)),
        ),
      ),
      IO.tap(() => logger.info("Initialized")),
    );

    // Register a handler that intercepts messages targeted at CONTENT_SCRIPT
    // and forwards them via postMessage (bypassing the bus filtering)
    setupForwarding: IO.IO<void> = () => {
      this.registerMessageHandler((envelope) =>
        pipe(
          IO.of(envelope),
          IO.flatMap((env) => {
            // Forward messages targeted at CONTENT_SCRIPT
            if (env.target === "CONTENT_SCRIPT" && FORWARD_TO_CONTENT_SCRIPT.includes(env.message.type)) {
              return pipe(
                logForwardedMessage(env),
                IO.flatMap(() => postMessage(env)),
              );
            }
            // For messages targeted at BRIDGE_SCRIPT, dispatch to bus
            if (env.target === "BRIDGE_SCRIPT") {
              return this.bus.dispatch(env);
            }
            return IO.of(undefined);
          }),
        ),
      )();
    };

    forwardToBackgroundScript = (event: Event): void => {
      if (!isMessageEvent(event)) return;

      pipe(
        validateEnvelope(event.data),
        E.flatMap(validateTarget("BACKGROUND_SCRIPT")),
        E.match(
          () => undefined,
          (envelope) => {
            logger.info(`Forwarding to background: ${envelope.message.type}`)();
            this.sendMessage(envelope)();
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
