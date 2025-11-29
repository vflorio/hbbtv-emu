import { type Application, type ClassType, compose, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import { createApplication } from "./application";

export interface OipfApplicationManager {
  onLowMemory: () => void;
  getOwnerApplication: (document: Document) => Application;
}

const logger = createLogger("OipfApplicationManager");

const WithMemoryManagement = <T extends ClassType>(Base: T) =>
  class extends Base {
    onLowMemory = (): void => logger.info("onLowMemory")();
  };

const WithApplicationCache = <T extends ClassType>(Base: T) =>
  class extends Base {
    private applicationCacheRef = IORef.newIORef<WeakMap<Document, Application>>(new WeakMap())();

    getOwnerApplication = (document: Document): Application =>
      pipe(
        logger.info("getOwnerApplication"),
        IO.map(() => {
          const cache = this.applicationCacheRef.read();
          let app = cache.get(document);
          if (!app) {
            app = createApplication(document);
            cache.set(document, app);
            this.applicationCacheRef.write(cache);
          }
          return app;
        }),
      )();
  };

const ApplicationManagerClass = compose(class {}, WithMemoryManagement, WithApplicationCache);

export const createApplicationManager = (): OipfApplicationManager => new ApplicationManagerClass();
