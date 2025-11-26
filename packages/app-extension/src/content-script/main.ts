import { type App, type ClassType, compose, initApp, type MessageBus, WithMessageBus } from "@hbb-emu/lib";
import { type ObjectHandler, WithObjectHandler } from "./objectHandler";

const WithContentScript = <T extends ClassType<MessageBus & ObjectHandler>>(Base: T) =>
  class extends Base implements App {
    mutationObserver: MutationObserver | null = null;

    constructor(...args: any[]) {
      super(...args);
      this.setupMessageHandlers();
    }

    setupMessageHandlers = () => {
      // this.bus.on("UPDATE_CHANNELS", ({ payload }) => {  });
    };

    init = () => {
      this.attachObjects(document);

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

const ContentScript = compose(class {}, WithMessageBus("CONTENT_SCRIPT"), WithObjectHandler, WithContentScript);
initApp(new ContentScript());
