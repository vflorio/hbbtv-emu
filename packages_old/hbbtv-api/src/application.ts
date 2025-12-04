import {
  type Application,
  type ApplicationPrivateData,
  type Channel,
  ChannelIdType,
  type ClassType,
  compose,
  createLogger,
  isValidChannelTriplet,
  type MessageBus,
  WithMessageBus,
  WithPostMessageAdapter,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import { createKeyset } from "./keyset";

interface PerformanceMemory {
  usedJSHeapSize: number;
}

const logger = createLogger("Application");

class ApplicationBase {
  constructor(protected documentRef: Document) {}
}

const WithPrivateData = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base {
    currentChannelRef = IORef.newIORef<O.Option<Channel>>(O.none)();

    privateData: ApplicationPrivateData = {
      keyset: createKeyset(),
      currentChannel: null,
      getFreeMem: () => {
        const perf = performance as Performance & { memory?: PerformanceMemory };
        if (typeof performance !== "undefined" && perf.memory) {
          return perf.memory.usedJSHeapSize || 0;
        }
        return 0;
      },
    };

    constructor(...args: any[]) {
      super(...args);

      Object.defineProperty(this.privateData, "currentChannel", {
        get: () => pipe(this.currentChannelRef.read(), O.toNullable),
        enumerable: true,
        configurable: true,
      });

      this.bus.on("UPDATE_CONFIG", (envelope) =>
        pipe(
          IO.of(envelope.message.payload.channels),
          IO.map(A.filter(isValidChannelTriplet)),
          IO.map(
            A.map((channel) => ({
              idType: ChannelIdType.ID_DVB_T,
              ...channel,
            })),
          ),
          IO.map(A.head),
          IO.flatMap((firstChannel) => this.currentChannelRef.write(firstChannel)),
        ),
      );
    }
  };

interface Visibility {
  visible: boolean | undefined;
  show: () => boolean;
  hide: () => boolean;
}

const WithVisibility = <T extends ClassType<ApplicationBase>>(Base: T) =>
  class extends Base implements Visibility {
    visibleRef = IORef.newIORef<O.Option<boolean>>(O.none)();

    visible: boolean | undefined = undefined;

    constructor(...args: any[]) {
      super(...args);
      Object.defineProperty(this, "visible", {
        get: () => pipe(this.visibleRef.read(), O.toUndefined),
        enumerable: true,
        configurable: true,
      });
    }

    show = (): boolean =>
      pipe(
        logger.info("show"),
        IO.map(() => {
          if (this.documentRef?.body) {
            this.documentRef.body.style.visibility = "visible";
            this.visibleRef.write(O.some(true));
            return true;
          }
          return false;
        }),
      )();

    hide = (): boolean =>
      pipe(
        logger.info("hide"),
        IO.map(() => {
          if (this.documentRef?.body) {
            this.documentRef.body.style.visibility = "hidden";
            this.visibleRef.write(O.some(false));
            return true;
          }
          return false;
        }),
      )();
  };

interface Lifecycle {
  createApplication: (uri: string, createChild?: boolean) => void;
  destroyApplication: () => void;
}

const WithLifecycle = <T extends ClassType<ApplicationBase>>(Base: T) =>
  class extends Base implements Lifecycle {
    createApplication = (_uri: string, _createChild?: boolean): void => logger.info("createApplication")();

    destroyApplication = (): void => logger.info("destroyApplication")();
  };

const ApplicationClass = compose(
  ApplicationBase,
  WithPostMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithPrivateData,
  WithVisibility,
  WithLifecycle,
);

export const createApplication = (document: Document): Application => new ApplicationClass(document);
