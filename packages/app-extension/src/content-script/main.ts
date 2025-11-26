import { type App, bridgeProxyPrefix, type ClassType, compose, initApp } from "@hbb-emu/lib";
import { type ObjectHandler, WithObjectHandler } from "./objectHandler";

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
          console.log("[HbbTV Content] Received channels:", event.data.payload);
          break;
        case `${bridgeProxyPrefix}UPDATE_VERSION`:
          console.log("[HbbTV Content] Received version:", event.data.payload);
          break;
        case `${bridgeProxyPrefix}UPDATE_COUNTRY_CODE`:
          console.log("[HbbTV Content] Received country code:", event.data.payload);
          break;
        case `${bridgeProxyPrefix}UPDATE_CAPABILITIES`:
          console.log("[HbbTV Content] Received capabilities:", event.data.payload);
          break;
      }
    };

    init = () => {
      console.log("[HbbTV Content] Initialized in MAIN world");
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

const ContentScript = compose(class {}, WithObjectHandler, WithContentScript);
initApp(new ContentScript());
