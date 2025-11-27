import {
  type App,
  type ClassType,
  compose,
  createLogger,
  initApp,
  type MessageAdapter,
  type MessageBus,
  type MessageEnvelope,
  WithChromeMessageAdapter,
  WithMessageBus,
} from "@hbb-emu/lib";

const logger = createLogger("BridgeScript");

const WithBridge = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    constructor(...args: any[]) {
      super(...args);

      this.registerMessageBus("BRIDGE_SCRIPT", this.handleChromeMessage, this.shouldHandleMessage);
      window.addEventListener("message", this.handlePageMessage);
    }

    shouldHandleMessage = (envelope: MessageEnvelope) => envelope.source === "SERVICE_WORKER";

    init = () => {
      logger.log("Initialized ");
    };

    handleChromeMessage = (envelope: MessageEnvelope) => {
      logger.debug(`Forwarding chrome.runtime → page: ${envelope.message.type}`);
      window.postMessage(envelope, "*");
    };

    handlePageMessage = async (event: MessageEvent<MessageEnvelope>) => {
      if (event.source !== window) return;

      const data = event.data;

      const isValid = typeof data === "object" && data !== null && "type" in data && typeof data.type === "string";

      if (!isValid) return;

      logger.debug(`Forwarding page → chrome.runtime: ${data.type}`);

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
