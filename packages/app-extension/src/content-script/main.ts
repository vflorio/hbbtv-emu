import {
  type App,
  bridgeProxyPrefix,
  type ClassType,
  compose,
  createLogger,
  initApp,
} from "@hbb-emu/lib";
import { WithContentScriptMessageBus } from "./messageBus";
import { type ObjectHandler, WithObjectHandler } from "./objectHandler";

const logger = createLogger("ContentScript");

const WithContentScript = <T extends ClassType<ObjectHandler>>(Base: T) =>
  class extends Base implements App {
    mutationObserver: MutationObserver | null = null;

    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handleMessage);
    }

    handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      switch (event.data?.type) {
        case `${bridgeProxyPrefix}UPDATE_CHANNELS`:
          logger.log("Received channels:", event.data.payload);
          break;
        case `${bridgeProxyPrefix}UPDATE_VERSION`:
          logger.log("Received version:", event.data.payload);
          break;
        case `${bridgeProxyPrefix}UPDATE_COUNTRY_CODE`:
          logger.log("Received country code:", event.data.payload);
          break;
        case `${bridgeProxyPrefix}UPDATE_CAPABILITIES`:
          logger.log("Received capabilities:", event.data.payload);
          break;
      }
    };

    init = () => {
      this.attachObjects(document);
      logger.log("Initialized");

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

const ContentScript = compose(
  class {},
  WithContentScriptMessageBus,
  WithObjectHandler,
  WithContentScript,
);
initApp(new ContentScript());
