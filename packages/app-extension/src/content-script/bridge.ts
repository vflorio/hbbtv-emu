import {
  type App,
  bridgeProxyPrefix,
  type ClassType,
  compose,
  initApp,
  type MessageBus,
  validMessageType,
  WithMessageBus,
} from "@hbb-emu/lib";

const WithBridge = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base implements App {
    init = () => {
      console.log("[HbbTV Bridge] Initialized");
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
        this.bus.on(messageType, ({ payload }) => this.forward(messageType, payload));
      });
    };

    handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;

      if (event.data?.type?.startsWith("HBBTV_EMU_")) {
        // TODO: Forward messages from the main world to the extension if needed
      }
    };
  };

const BridgeScript = compose(class {}, WithMessageBus("CONTENT_SCRIPT"), WithBridge);
initApp(new BridgeScript());
