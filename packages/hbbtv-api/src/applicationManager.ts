import type { Application } from "./application";
import { createApplication } from "./application";
import { log } from "./utils";

export interface OipfApplicationManager {
  onLowMemory: () => void;
  getOwnerApplication: (document: Document) => Application;
}

// Store application instances per document
const applicationCache = new WeakMap<Document, Application>();

export const createApplicationManager = (): OipfApplicationManager => ({
  onLowMemory: () => {
    log("oipfApplicationManager.onLowMemory");
  },

  getOwnerApplication: (document: Document) => {
    log("oipfApplicationManager.getOwnerApplication");

    let app = applicationCache.get(document);
    if (!app) {
      app = createApplication(document);
      applicationCache.set(document, app);
    }

    return app;
  },
});
