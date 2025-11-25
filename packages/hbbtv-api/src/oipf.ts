import type { Oipf } from "@hbb-emu/lib";
import { createChannelList, createProgrammes } from "./channels";

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
