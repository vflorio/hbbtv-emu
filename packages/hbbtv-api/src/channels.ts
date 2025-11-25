import { type Channel, ChannelIdType, type ChannelList, type ChannelTriplet, type Programme } from "@hbb-emu/lib";

export const serializeTriplet = (triplet: ChannelTriplet) => `${triplet.onid}-${triplet.tsid}-${triplet.sid}`;

export const hasTriplet = (channel: Channel): channel is Channel & ChannelTriplet =>
  typeof channel.onid === "number" && typeof channel.tsid === "number" && typeof channel.sid === "number";

const defaultChannel: Channel = {
  idType: ChannelIdType.ID_DVB_T,
  name: "channel0",
  ccid: "ccid:dvbt.0",
  onid: 1,
  tsid: 1,
  sid: 1,
};

export interface ChannelListInternal extends ChannelList {
  _list: Channel[];
}

export const createChannelList = (): ChannelListInternal => {
  const channels: Channel[] = [defaultChannel];

  return {
    _list: channels,
    length: channels.length,
    item: (index: number) => channels[index] || null,
    getChannel: (ccid: string) => channels.find((ch) => ch.ccid === ccid) || null,
    getChannelByTriplet: (onid: number, tsid: number, sid: number, _nid?: number) =>
      channels.find((ch) => ch.onid === onid && ch.tsid === tsid && ch.sid === sid) || null,
  };
};

export const createProgrammes = (): Programme[] => {
  const now = Date.now() / 1000;

  return [
    {
      programmeID: "event1",
      name: "Event 1",
      channelId: "ccid:dvbt.0",
      duration: 600,
      startTime: now,
      description: "EIT present event is under construction",
    },
    {
      programmeID: "event2",
      name: "Event 2",
      channelId: "ccid:dvbt.0",
      duration: 300,
      startTime: now + 600,
      description: "EIT following event is under construction",
    },
  ];
};
