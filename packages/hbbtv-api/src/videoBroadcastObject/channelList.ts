import {
  type Channel,
  ChannelIdType,
  type ChannelList as ChannelListType,
  type ClassType,
  isValidChannelTriplet,
  type MessageBus,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";

export namespace ChannelList {
  export interface Contract extends ChannelListType {}

  export type Item = (index: number) => Channel | null;
  export type GetChannel = (ccid: string) => Channel | null;
  export type GetChannelByTriplet = (onid: number, tsid: number, sid: number, nid?: number) => Channel | null;
}

export const WithChannelList = <T extends ClassType<MessageBus.Contract>>(Base: T) =>
  class extends Base implements ChannelList.Contract {
    channelListRef = IORef.newIORef<Channel[]>([])();

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) =>
        pipe(
          payload.channels,
          A.filter(isValidChannelTriplet),
          A.map((channel) => ({
            idType: ChannelIdType.ID_DVB_T,
            ...channel,
          })),
          this.channelListRef.write,
        ),
      );
    }

    get channelList(): Channel[] {
      return this.channelListRef.read();
    }

    get length(): number {
      return this.channelListRef.read().length;
    }

    item: ChannelList.Item = (index) => pipe(this.channelListRef.read(), A.lookup(index), O.toNullable);

    getChannel: ChannelList.GetChannel = (ccid) =>
      pipe(
        this.channelListRef.read(),
        A.findFirst((channel) => channel.ccid === ccid),
        O.toNullable,
      );

    getChannelByTriplet: ChannelList.GetChannelByTriplet = (onid, tsid, sid, _nid?) =>
      pipe(
        this.channelListRef.read(),
        A.findFirst((channel) => channel.onid === onid && channel.tsid === tsid && channel.sid === sid),
        O.toNullable,
      );
  };
