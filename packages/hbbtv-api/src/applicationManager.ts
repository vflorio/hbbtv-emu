import type { Application } from "./application";
import { createApplication } from "./application";
import { logger } from "./utils";

export interface OipfApplicationManager {
  onLowMemory: () => void;
  getOwnerApplication: (document: Document) => Application;
}

// Store application instances per document
const applicationCache = new WeakMap<Document, Application>();

const log = logger("OipfApplicationManager");

export const createApplicationManager = (): OipfApplicationManager => ({
  onLowMemory: () => {
    log("onLowMemory");
  },

  getOwnerApplication: (document: Document) => {
    log("getOwnerApplication");

    let app = applicationCache.get(document);
    if (!app) {
      app = createApplication(document);
      applicationCache.set(document, app);
    }

    return app;
  },
});
