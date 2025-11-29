import {
  type Channel,
  type ClassType,
  createLogger,
  isValidChannelTriplet,
  type MessageBus,
  serializeChannelTriplet,
} from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";

export interface ChannelStreamAdapter {
  get channelStreamUrls(): Map<string, string>;
  getChannelStreamUrl: (channel: Channel) => string;
}

const logger = createLogger("VideoBroadcast/ChannelStreamAdapter");

export const WithChannelStreamAdapter = <T extends ClassType<MessageBus.Type>>(Base: T) =>
  class extends Base implements ChannelStreamAdapter {
    channelStreamUrlsRef = IORef.newIORef<Map<string, string>>(new Map())();

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        const streamUrls = new Map<string, string>();
        payload.channels.forEach((channel) => {
          streamUrls.set(serializeChannelTriplet(channel), channel.mp4Source);
        });
        this.channelStreamUrlsRef.write(streamUrls);
      });
    }

    get channelStreamUrls(): Map<string, string> {
      return this.channelStreamUrlsRef.read();
    }

    getChannelStreamUrl = (channel: Channel): string => {
      const key = isValidChannelTriplet(channel) ? serializeChannelTriplet(channel) : channel?.ccid || "";
      return pipe(
        logger.info(`Getting stream URL for channel: ${key}`),
        IO.map(() => this.channelStreamUrlsRef.read().get(key) || ""),
      )();
    };
  };
