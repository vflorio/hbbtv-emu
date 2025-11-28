import {
  type App,
  type Channel,
  type ClassType,
  compose,
  createEnvelope,
  createLogger,
  initApp,
  type MessageAdapter,
  type MessageBus,
  WithMessageBus,
  WithPostMessageAdapter,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type ObjectHandler, WithObjectHandler } from "./objectHandler";

const logger = createLogger("ContentScript");

const WithContentScript = <T extends ClassType<ObjectHandler & MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    mutationObserver: MutationObserver | null = null;
    currentChannelFromConfig: Channel | null = null;

    init: IO.IO<void> = pipe(
      IO.of<void>(undefined),
      IO.tap(() => () => {
        this.bus.on("BRIDGE_READY", async () => {
          pipe(
            logger.info("Bridge is ready"),
            IO.flatMap(
              () => () =>
                this.sendMessage(
                  createEnvelope(this.messageOrigin, "BACKGROUND_SCRIPT", {
                    type: "CONTENT_SCRIPT_READY",
                    payload: null,
                  }),
                ),
            ),
          )();
        });

        this.attachObjects(document);
      }),
      IO.flatMap(() => logger.info("Initialized")),
    );

    attachObjects = (context: Document | HTMLElement) => {
      pipe(
        context.querySelectorAll<HTMLObjectElement>("object"),
        (nodeList) => Array.from(nodeList),
        A.map((element) => this.attachObject(element)),
      );
    };
  };

// biome-ignore format: ack
const ContentScript = compose(
  class { },
  WithPostMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithObjectHandler,
  WithContentScript
);

initApp(new ContentScript())();
