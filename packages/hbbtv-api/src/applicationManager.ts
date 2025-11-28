import { type Application, type ClassType, compose, createLogger } from "@hbb-emu/lib";
import * as IORef from "fp-ts/IORef";
import { createApplication } from "./application";

export interface OipfApplicationManager {
  onLowMemory: () => void;
  getOwnerApplication: (document: Document) => Application;
}

const logger = createLogger("OipfApplicationManager");

class ApplicationManagerBase {}

const WithMemoryManagement = <T extends ClassType<ApplicationManagerBase>>(Base: T) =>
  class extends Base {
    onLowMemory = (): void => {
      logger.log("onLowMemory");
    };
  };

const WithApplicationCache = <T extends ClassType<ApplicationManagerBase>>(Base: T) =>
  class extends Base {
    private applicationCacheRef = IORef.newIORef<WeakMap<Document, Application>>(new WeakMap())();

    getOwnerApplication = (document: Document): Application => {
      logger.log("getOwnerApplication");

      const cache = this.applicationCacheRef.read();
      let app = cache.get(document);
      if (!app) {
        app = createApplication(document);
        cache.set(document, app);
        this.applicationCacheRef.write(cache);
      }

      return app;
    };
  };

const ApplicationManagerClass = compose(ApplicationManagerBase, WithMemoryManagement, WithApplicationCache);

export const createApplicationManager = (): OipfApplicationManager => new ApplicationManagerClass();
