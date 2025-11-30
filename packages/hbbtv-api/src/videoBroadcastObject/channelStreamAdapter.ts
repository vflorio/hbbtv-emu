import {
  type Channel,
  type ClassType,
  isValidChannelTriplet,
  type MessageBus,
  serializeChannelTriplet,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";

export namespace ChannelStreamAdapter {
  export interface Contract {
    getChannelStreamUrl: GetChannelStreamUrl;
  }

  export type GetChannelStreamUrl = (channel: Channel) => O.Option<string>;
}

export const WithChannelStreamAdapter = <T extends ClassType<MessageBus.Contract>>(Base: T) =>
  class extends Base implements ChannelStreamAdapter.Contract {
    channelStreamUrlsRef = IORef.newIORef<Record<string, string>>({})();

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) =>
        pipe(
          IO.of(payload),
          IO.flatMap(({ channels }) =>
            pipe(
              channels,
              A.reduce({}, (acc, channel) => ({
                ...acc,
                [serializeChannelTriplet(channel)]: channel.mp4Source,
              })),
              this.channelStreamUrlsRef.write,
            ),
          ),
        ),
      );
    }

    getChannelStreamUrl: ChannelStreamAdapter.GetChannelStreamUrl = (channel) =>
      pipe(
        channel,
        O.fromPredicate(isValidChannelTriplet),
        O.map(serializeChannelTriplet),
        O.flatMap((key) => pipe(this.channelStreamUrlsRef.read()[key], O.fromNullable)),
      );
  };
