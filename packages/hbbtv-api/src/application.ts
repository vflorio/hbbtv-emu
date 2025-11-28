import { type Application, type ApplicationPrivateData, type ClassType, compose, createLogger } from "@hbb-emu/lib";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/function";
import { createKeyset } from "./keyset";

interface PerformanceMemory {
  usedJSHeapSize: number;
}

const logger = createLogger("Application");

class ApplicationBase {
  constructor(protected documentRef: Document) {}
}

const WithPrivateData = <T extends ClassType<ApplicationBase>>(Base: T) =>
  class extends Base {
    private getFreeMem = () => {
      const perf = performance as Performance & { memory?: PerformanceMemory };
      if (typeof performance !== "undefined" && perf.memory) {
        return perf.memory.usedJSHeapSize || 0;
      }
      return 0;
    };

    get privateData(): ApplicationPrivateData {
      return {
        keyset: createKeyset(),
        get currentChannel() {
          return null;
        },
        getFreeMem: this.getFreeMem,
      };
    }
  };

interface Visibility {
  visible: boolean | undefined;
  show: () => boolean;
  hide: () => boolean;
}

const WithVisibility = <T extends ClassType<ApplicationBase>>(Base: T) =>
  class extends Base implements Visibility {
    private visibleRef = IORef.newIORef<O.Option<boolean>>(O.none)();

    get visible(): boolean | undefined {
      return pipe(this.visibleRef.read(), O.toUndefined);
    }

    show = (): boolean => {
      logger.log("show");
      if (this.documentRef?.body) {
        this.documentRef.body.style.visibility = "visible";
        this.visibleRef.write(O.some(true));
        return true;
      }
      return false;
    };

    hide = (): boolean => {
      logger.log("hide");
      if (this.documentRef?.body) {
        this.documentRef.body.style.visibility = "hidden";
        this.visibleRef.write(O.some(false));
        return true;
      }
      return false;
    };
  };

interface Lifecycle {
  createApplication: (uri: string, createChild?: boolean) => void;
  destroyApplication: () => void;
}

const WithLifecycle = <T extends ClassType<ApplicationBase>>(Base: T) =>
  class extends Base implements Lifecycle {
    createApplication = (_uri: string, _createChild?: boolean): void => {
      logger.log("createApplication");
    };

    destroyApplication = (): void => {
      logger.log("destroyApplication");
    };
  };

const ApplicationClass = compose(ApplicationBase, WithPrivateData, WithVisibility, WithLifecycle);

export const createApplication = (document: Document): Application => new ApplicationClass(document);
