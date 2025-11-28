import {
  type App,
  type ClassType,
  compose,
  createEnvelope,
  createLogger,
  initApp,
  isValidMessageEnvelope,
  type MessageAdapter,
  type MessageBus,
  type MessageEnvelope,
  WithChromeMessageAdapter,
  WithMessageBus,
} from "@hbb-emu/lib";

const logger = createLogger("BridgeScript");

const WithBridge = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    init = async () => {
      this.registerMessageBus("BRIDGE_SCRIPT", this.forwardToContentScript);
      window.addEventListener("message", this.forwardToServiceWorker);

      window.postMessage(
        createEnvelope(this.messageOrigin, "CONTENT_SCRIPT", { type: "BRIDGE_READY", payload: null }),
        "*",
      );
      logger.log("Initialized");
    };

    forwardToContentScript = (envelope: MessageEnvelope) => {
      if (!isValidMessageEnvelope(envelope)) return;
      if (envelope.target !== "CONTENT_SCRIPT") return;

      logger.log(`Forwarding ${envelope.source} → ${envelope.target}: ${envelope.message.type}`);
      window.postMessage(envelope, "*");
    };

    forwardToServiceWorker = async (event: MessageEvent<MessageEnvelope>) => {
      if (!isValidMessageEnvelope(event.data)) return;
      if (event.data.target !== "SERVICE_WORKER") return;

      logger.log(`Forwarding ${event.data.source} → ${event.data.target}: ${event.data.message.type}`);
      await this.sendMessage(event.data);
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
