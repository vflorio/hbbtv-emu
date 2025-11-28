import {
  type App,
  type ClassType,
  compose,
  createEnvelope,
  createLogger,
  initApp,
  type MessageAdapter,
  type MessageBus,
  WithMessageBus,
  WithPostMessageAdapter,
} from "@hbb-emu/lib";
import { type ObjectHandler, WithObjectHandler } from "./objectHandler";

const logger = createLogger("ContentScript");

const WithContentScript = <T extends ClassType<ObjectHandler & MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    mutationObserver: MutationObserver | null = null;

    init = async () => {
      this.bus.on("BRIDGE_READY", async () => {
        logger.log("Bridge is ready");
        await this.sendMessage(
          createEnvelope(this.messageOrigin, "SERVICE_WORKER", { type: "CONTENT_SCRIPT_READY", payload: null }),
        );
      });

      this.attachObjects(document);
      logger.log("Initialized");
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
