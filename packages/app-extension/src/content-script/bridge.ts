import {
  type App,
  bridgeProxyPrefix,
  type ClassType,
  compose,
  createLogger,
  initApp,
  type MessageBus,
  validMessageType,
  WithChromeMessageAdapter,
  WithMessageBus,
} from "@hbb-emu/lib";

const logger = createLogger("BridgeScript");

const WithBridge = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base implements App {
    init = () => {
      logger.log("Initialized");
      window.addEventListener("message", this.handleMessage);
      this.forwardAll();
    };

    forward = (messageType: string, payload: unknown) =>
      window.postMessage(
        {
          type: bridgeProxyPrefix + messageType,
          payload,
        },
        "*",
      );

    forwardAll = () => {
      validMessageType.forEach((messageType) => {
        this.bus.on(messageType, ({ message: { payload } }) => this.forward(messageType, payload));
      });
    };

    handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;

      if (event.data?.type?.startsWith("HBBTV_EMU_")) {
        // TODO: Forward messages from the main world to the extension if needed
      }
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
