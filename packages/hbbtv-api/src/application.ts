import { type Application, type ApplicationPrivateData, type ClassType, compose, createLogger } from "@hbb-emu/lib";
import { createKeyset } from "./keyset";
import { createOipf } from "./oipf";

interface PerformanceMemory {
  usedJSHeapSize: number;
}

const logger = createLogger("Application");

class ApplicationBase {
  constructor(protected documentRef: Document) {}
}

const WithPrivateData = <T extends ClassType<ApplicationBase>>(Base: T) =>
  class extends Base {
    private oipf = createOipf();

    private getFreeMem = (): number => {
      const perf = performance as Performance & { memory?: PerformanceMemory };
      if (typeof performance !== "undefined" && perf.memory) {
        return perf.memory.usedJSHeapSize || 0;
      }
      return 0;
    };

    get privateData(): ApplicationPrivateData {
      const oipf = this.oipf;
      return {
        keyset: createKeyset(),
        get currentChannel() {
          logger.log("currentChannel");
          const currentCcid = oipf.getCurrentTVChannel().ccid || "ccid:dvbt.0";
          return oipf.channelList.getChannel(currentCcid);
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
    private _visible: boolean | undefined;

    get visible() {
      return this._visible;
    }

    show = (): boolean => {
      logger.log("show");
      if (this.documentRef?.body) {
        this.documentRef.body.style.visibility = "visible";
        this._visible = true;
        return true;
      }
      return false;
    };

    hide = (): boolean => {
      logger.log("hide");
      if (this.documentRef?.body) {
        this.documentRef.body.style.visibility = "hidden";
        this._visible = false;
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
