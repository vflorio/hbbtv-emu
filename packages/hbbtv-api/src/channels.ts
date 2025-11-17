import type { Collection } from "./utils";

export enum ChannelIdType {
  ID_ANALOG = 0,
  ID_DVB_C = 1,
  ID_DVB_S = 2,
  ID_DVB_T = 3,
  ID_DVB_SI_DIRECT = 13,
  ID_IPTV_SDS = 20,
  ID_IPTV_URI = 21,
  ID_ISDB_S = 30,
  ID_ISDB_T = 31,
  ID_ISDB_C = 32,
  ID_ATSC_T = 40,
}

export interface Channel {
  ccid?: string;
  name?: string;
  majorChannel?: number;
  minorChannel?: number;
  ipBroadcastID?: string;
  idType: ChannelIdType;
  onid?: number;
  tsid?: number;
  sid?: number;
  sourceID?: number;
  dsd?: string;
  channelType?: number;
  nid?: number;
  channelMaxBitRate?: number;
  hidden?: boolean;
  manualBlock?: boolean;
  locked?: boolean;
}

export interface ParentalRating {
  scheme: string;
  region?: string;
  value: number;
  labels?: string[];
}

export interface Programme {
  programmeID: string;
  name: string;
  description?: string;
  longDescription?: string;
  startTime: number;
  duration: number;
  channelId: string;
  programmeIDType?: number;
  parentalRatings?: Collection<ParentalRating>;
}
export interface ChannelList {
  readonly length: number;
  item(index: number): Channel | null;
  getChannel(ccid: string): Channel | null;
  getChannelByTriplet(onid: number, tsid: number, sid: number, nid?: number): Channel | null;
}

export interface ChannelConfig {
  channelList: { readonly length: number; item(index: number): Channel | null };
  readonly favouriteLists?: unknown;
}

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
