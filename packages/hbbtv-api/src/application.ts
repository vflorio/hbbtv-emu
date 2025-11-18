import type { Channel } from "./channels";
import { createKeyset, type Keyset } from "./keyset";
import { createOipf } from "./oipf";
import { log } from "./utils";

export interface Application {
  visible: boolean | undefined;
  privateData: ApplicationPrivateData;
  show: () => boolean;
  hide: () => boolean;
  createApplication: (uri: string, createChild?: boolean) => void;
  destroyApplication: () => void;
}

export interface ApplicationPrivateData {
  keyset: Keyset;
  currentChannel: Channel;
  getFreeMem: () => number;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
}

export const createApplication = (doc: Document): Application => {
  const documentRef = doc;
  let visible: boolean | undefined;

  const oipf = createOipf();

  const getFreeMem = (): number => {
    const perf = performance as Performance & { memory?: PerformanceMemory };
    if (typeof performance !== "undefined" && perf.memory) {
      return perf.memory.usedJSHeapSize || 0;
    }
    return 0;
  };

  const getCurrentChannel = (): Channel => {
    const currentCcid = oipf.getCurrentTVChannel().ccid || "ccid:dvbt.0";
    return oipf.channelList.getChannel(currentCcid) || ({} as Channel);
  };

  const privateData: ApplicationPrivateData = {
    keyset: createKeyset(),
    get currentChannel() {
      log("Application.currentChannel");
      return getCurrentChannel();
    },
    getFreeMem,
  };

  return {
    get visible() {
      return visible;
    },

    privateData,

    show() {
      log("Application.show");
      if (documentRef?.body) {
        documentRef.body.style.visibility = "visible";
        visible = true;
        return true;
      }
      return false;
    },

    hide() {
      log("Application.hide");
      if (documentRef?.body) {
        documentRef.body.style.visibility = "hidden";
        visible = false;
        return true;
      }
      return false;
    },

    createApplication(_uri: string, _createChild?: boolean) {
      log("Application.createApplication");
    },

    destroyApplication() {
      log("Application.destroyApplication");
    },
  };
};
