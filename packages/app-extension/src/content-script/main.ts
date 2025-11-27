import {
  type App,
  type ClassType,
  compose,
  createLogger,
  initApp,
  type MessageAdapter,
  type MessageBus,
  type MessageEnvelope,
  WithMessageBus,
  WithPostMessageAdapter,
} from "@hbb-emu/lib";
import { type ObjectHandler, WithObjectHandler } from "./objectHandler";

const logger = createLogger("ContentScript");

const WithContentScript = <T extends ClassType<ObjectHandler & MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    mutationObserver: MutationObserver | null = null;

    constructor(...args: any[]) {
      super(...args);
      this.registerMessageBus("CONTENT_SCRIPT", this.handleIncomingMessage, this.shouldHandleMessage);
    }

    shouldHandleMessage = (envelope: MessageEnvelope) => envelope.target === "CONTENT_SCRIPT";

    handleIncomingMessage = (envelope: MessageEnvelope) => {
      const { message } = envelope;
      switch (message.type) {
        case "UPDATE_CHANNELS":
          logger.log("Received channels:", message.payload);
          break;
        case "UPDATE_VERSION":
          logger.log("Received version:", message.payload);
          break;
        case "UPDATE_COUNTRY_CODE":
          logger.log("Received country code:", message.payload);
          break;
        case "UPDATE_CAPABILITIES":
          logger.log("Received capabilities:", message.payload);
          break;
        default:
          logger.debug(`Unhandled message type: ${message.type}`);
      }
    };

    init = async () => {
      this.attachObjects(document);
      logger.log("Initialized");

      // Invia CONTENT_SCRIPT_READY con target SERVICE_WORKER
      await this.sendMessage(
        this.createEnvelope(
          { type: "CONTENT_SCRIPT_READY", payload: null },
          "SERVICE_WORKER" // Destinato al service worker, non al content script stesso
        ),
      );

      // TODO: Capire l'impatto sulle performance della pagina
      // this.mutationObserver = new MutationObserver((mutations) => {
      //   mutations
      //     .flatMap((mutation) => Array.from(mutation.addedNodes))
      //     .forEach((node) => {
      //       if (node instanceof HTMLObjectElement) {
      //         this.attachObject(node);
      //       } else if (node instanceof HTMLElement) {
      //         this.attachObjects(node);
      //       }
      //     });
      // });
      //
      // this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    };

    attachObjects = (context: Document | HTMLElement) => {
      const elements = Array.from(context.querySelectorAll<HTMLObjectElement>("object"));
      for (const element of elements) {
        this.attachObject(element);
      }
    };
  };

// biome-ignore format: ack
const ContentScript = compose(
  class {}, 
  WithPostMessageAdapter, 
  WithMessageBus("CONTENT_SCRIPT"),
  WithObjectHandler, 
  WithContentScript
);
initApp(new ContentScript());
