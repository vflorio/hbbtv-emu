import {
  type Channel,
  type ClassType,
  createLogger,
  isValidChannelTriplet,
  type MessageBus,
  serializeChannelTriplet,
} from "@hbb-emu/lib";

export interface ChannelStreamAdapter {
  channelStreamUrls: Map<string, string>;
  getChannelStreamUrl: (channel: Channel) => string;
}

const logger = createLogger("VideoBroadcast/ChannelStreamAdapter");

export const WithChannelStreamAdapter = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base implements ChannelStreamAdapter {
    channelStreamUrls: Map<string, string> = new Map();

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CHANNELS", ({ message: { payload } }) => {
        payload.forEach((channel) => {
          this.channelStreamUrls.set(serializeChannelTriplet(channel), channel.mp4Source);
        });
      });
    }

    getChannelStreamUrl = (channel: Channel): string => {
      const key = isValidChannelTriplet(channel) ? serializeChannelTriplet(channel) : channel?.ccid || "";
      logger.log(`Getting stream URL for channel: ${key}`);
      return this.channelStreamUrls.get(key) || "";
    };
  };
