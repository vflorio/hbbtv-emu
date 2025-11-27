import {
  type Channel,
  ChannelIdType,
  type ChannelList,
  type ClassType,
  isChannelTriplet,
  type MessageBus,
} from "@hbb-emu/lib";

export const WithChannelList = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base implements ChannelList {
    channelList: Channel[] = [];

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CHANNELS", ({ message: { payload } }) => {
        this.channelList = payload.filter(isChannelTriplet).map((channel) => ({
          idType: ChannelIdType.ID_DVB_T,
          ...channel,
        }));
      });
    }

    get length(): number {
      return this.channelList.length;
    }

    item = (index: number) => this.channelList[index] || null;

    getChannel = (ccid: string) => this.channelList.find((ch) => ch.ccid === ccid) || null;

    getChannelByTriplet = (onid: number, tsid: number, sid: number, _nid?: number) =>
      this.channelList.find((ch) => ch.onid === onid && ch.tsid === tsid && ch.sid === sid) || null;
  };
