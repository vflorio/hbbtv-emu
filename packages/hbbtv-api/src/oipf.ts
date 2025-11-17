import { type Channel, type ChannelList, createChannelList, createProgrammes, type Programme } from "./channels";

export interface Oipf {
  channelList: ChannelList;
  programmes: Programme[];
  getCurrentTVChannel: () => Channel;
}

export const createOipf = (): Oipf => {
  const channelList = createChannelList();
  const programmes = createProgrammes();

  return {
    channelList,
    programmes,

    getCurrentTVChannel: () => {
      return channelList.getChannel("0") || channelList._list[0];
    },
  };
};
