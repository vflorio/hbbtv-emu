import {
  type App,
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
import * as IOO from "fp-ts/IOOption";
import { querySelectorAll } from "fp-ts-std/DOM";
import { type ObjectHandler, WithObjectHandler } from "./objectHandler";

const logger = createLogger("ContentScript");

export const WithContentScript = <
  T extends ClassType<ObjectHandler.Contract & MessageAdapter.Contract & MessageBus.Contract>,
>(
  Base: T,
) =>
  class extends Base implements App {
    init: IO.IO<void> = pipe(
      logger.info("Initializing"),
      IO.tap(() => this.subscribe),
      IO.tap(() => this.attachObjects),
      IO.tap(() => logger.info("Initialized")),
    );

    subscribe: IO.IO<void> = () =>
      pipe(
        logger.info("Subscribing to bridge ready message"),
        IO.tap(() => () => {
          this.bus.on(
            "BRIDGE_READY",
            pipe(
              logger.info("Bridge is ready"),
              IO.tap(() =>
                pipe(
                  IO.of(
                    createEnvelope(this.messageOrigin, "BACKGROUND_SCRIPT", {
                      type: "CONTENT_SCRIPT_READY",
                      payload: null,
                    }),
                  ),
                  IO.flatMap((envelope) => this.sendMessage(envelope)),
                ),
              ),
            ),
          );
        }),
      );

    attachObjects: IO.IO<void> = pipe(
      document,
      querySelectorAll("object"),
      IOO.matchE(() => IO.of(undefined), A.traverse(IO.Applicative)(this.attachObject)),
    );
  };

// biome-ignore format: ack
const ContentScript = compose(
  class {},
  WithPostMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithObjectHandler,
  WithContentScript
);

initApp(new ContentScript())();
