import type { VideoBroadcastObject as VideoBroadcast } from "@hbb-emu/hbbtv-api";
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
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import { WithDomObserver } from "../../../lib/src/domObserver";
import { type ElementMatcherRegistry, WithElementMatcherRegistry } from "./elementMatcher";
import { createDashSourceMatcher, createVideoBroadcastMatcher, type DashSource, oipfObjectMatcher } from "./matchers";

const logger = createLogger("ContentScript");

const onSourceDetected = (source: DashSource): void => {
  logger.info("Source element detected", { src: source.src, parentVideo: source.parentVideo?.id })();
};

export const WithContentScript = <T extends ClassType<MessageAdapter & MessageBus & ElementMatcherRegistry>>(Base: T) =>
  class extends Base implements App {
    videoBroadcastRef: IORef.IORef<O.Option<VideoBroadcast>> = IORef.newIORef<O.Option<VideoBroadcast>>(O.none)();

    init: IO.IO<void> = pipe(
      logger.info("Initializing"),
      IO.tap(() => this.subscribe),
      IO.tap(() => this.registerMatcher(oipfObjectMatcher)),
      IO.tap(() => this.registerMatcher(createVideoBroadcastMatcher(this.videoBroadcastRef))),
      IO.tap(() => this.registerMatcher(createDashSourceMatcher(onSourceDetected))),
      IO.tap(() => this.initMatchers),
      IO.tap(() => logger.info("Initialized")),
    );

    subscribe: IO.IO<void> = () =>
      pipe(
        logger.info("Subscribing to bridge ready message"),
        IO.tap(() => () => {
          this.bus.on("BRIDGE_READY", () =>
            pipe(
              logger.info("Bridge is ready"),
              IO.tap(() =>
                pipe(
                  this.messageOrigin.read,
                  IO.map((origin) =>
                    createEnvelope(origin, "BACKGROUND_SCRIPT", {
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
  };

// biome-ignore format: ack
const ContentScript = compose(
  class {},
  WithPostMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithDomObserver,
  WithElementMatcherRegistry,
  WithContentScript
);

initApp(new ContentScript())();
