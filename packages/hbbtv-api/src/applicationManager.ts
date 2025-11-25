import { type Application, type ClassType, compose, logger } from "@hbb-emu/lib";
import { createApplication } from "./application";

export interface OipfApplicationManager {
  onLowMemory: () => void;
  getOwnerApplication: (document: Document) => Application;
}

const log = logger("OipfApplicationManager");

// Store application instances per document
const applicationCache = new WeakMap<Document, Application>();

class ApplicationManagerBase {}

const WithMemoryManagement = <T extends ClassType<ApplicationManagerBase>>(Base: T) =>
  class extends Base {
    onLowMemory = (): void => {
      log("onLowMemory");
    };
  };

const WithApplicationCache = <T extends ClassType<ApplicationManagerBase>>(Base: T) =>
  class extends Base {
    getOwnerApplication = (document: Document): Application => {
      log("getOwnerApplication");

      let app = applicationCache.get(document);
      if (!app) {
        app = createApplication(document);
        applicationCache.set(document, app);
      }

      return app;
    };
  };

const ApplicationManagerClass = compose(ApplicationManagerBase, WithMemoryManagement, WithApplicationCache);

export const createApplicationManager = (): OipfApplicationManager => new ApplicationManagerClass();
