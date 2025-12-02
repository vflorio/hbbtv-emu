import {
  type Channel,
  type ClassType,
  createLogger,
  isValidChannelTriplet,
  type MessageBus,
  serializeChannelTriplet,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";

const logger = createLogger("VideoBroadcast/ChannelStreamAdapter");

export interface ChannelStreamAdapter {
  getChannelStreamUrl: (channel: Channel) => O.Option<string>;
}

export const WithChannelStreamAdapter = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base implements ChannelStreamAdapter {
    channelStreamUrlsRef = IORef.newIORef<Record<string, string>>({})();

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CONFIG", (envelope) =>
        pipe(
          IO.of(envelope.message.payload),
          IO.flatMap((payload) => {
            const urls = pipe(
              payload.channels,
              A.reduce({}, (acc, channel) => ({
                ...acc,
                [serializeChannelTriplet(channel)]: channel.mp4Source,
              })),
            );
            return pipe(
              logger.info("Updating channel stream URLs", urls),
              IO.flatMap(() => this.channelStreamUrlsRef.write(urls)),
            );
          }),
        ),
      );
    }

    getChannelStreamUrl = (channel: Channel): O.Option<string> =>
      pipe(
        channel,
        O.fromPredicate(isValidChannelTriplet),
        O.map(serializeChannelTriplet),
        O.chain((key) => {
          const urls = this.channelStreamUrlsRef.read();
          logger.info("getChannelStreamUrl", key, urls)();
          return O.fromNullable(urls[key]);
        }),
      );
  };
