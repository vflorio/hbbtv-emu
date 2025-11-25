import { type ClassType, compose, logger } from "@hbb-emu/lib";
import type { Channel } from "./channels";
import { createKeyset, type Keyset } from "./keyset";
import { createOipf } from "./oipf";

export interface ApplicationPrivateData {
  keyset: Keyset;
  currentChannel: Channel;
  getFreeMem: () => number;
}

export interface Application {
  visible: boolean | undefined;
  privateData: ApplicationPrivateData;
  show: () => boolean;
  hide: () => boolean;
  createApplication: (uri: string, createChild?: boolean) => void;
  destroyApplication: () => void;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
}

const log = logger("Application");

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
          log("currentChannel");
          const currentCcid = oipf.getCurrentTVChannel().ccid || "ccid:dvbt.0";
          return oipf.channelList.getChannel(currentCcid) || ({} as Channel);
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
      log("show");
      if (this.documentRef?.body) {
        this.documentRef.body.style.visibility = "visible";
        this._visible = true;
        return true;
      }
      return false;
    };

    hide = (): boolean => {
      log("hide");
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
      log("createApplication");
    };

    destroyApplication = (): void => {
      log("destroyApplication");
    };
  };

const ApplicationClass = compose(ApplicationBase, WithPrivateData, WithVisibility, WithLifecycle);

export const createApplication = (document: Document): Application => new ApplicationClass(document);
