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

export interface ChannelList extends ChannelListType {
  item: (index: number) => Channel | null;
  getChannel: (ccid: string) => Channel | null;
  getChannelByTriplet: (onid: number, tsid: number, sid: number, nid?: number) => Channel | null;
}

export const WithChannelList = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base implements ChannelList {
    channelListRef = IORef.newIORef<Channel[]>([])();

    channelList: Channel[] = [];
    length = 0;

    constructor(...args: any[]) {
      super(...args);

      Object.defineProperty(this, "channelList", {
        get: () => this.channelListRef.read(),
        enumerable: true,
        configurable: true,
      });

      Object.defineProperty(this, "length", {
        get: () => this.channelListRef.read().length,
        enumerable: true,
        configurable: true,
      });

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

    item = (index: number): Channel | null => pipe(this.channelListRef.read(), A.lookup(index), O.toNullable);

    getChannel = (ccid: string): Channel | null =>
      pipe(
        this.channelListRef.read(),
        A.findFirst((channel) => channel.ccid === ccid),
        O.toNullable,
      );

    getChannelByTriplet = (onid: number, tsid: number, sid: number, _nid?: number): Channel | null =>
      pipe(
        this.channelListRef.read(),
        A.findFirst((channel) => channel.onid === onid && channel.tsid === tsid && channel.sid === sid),
        O.toNullable,
      );
  };
