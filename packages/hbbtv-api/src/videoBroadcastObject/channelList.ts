import {
  type Channel,
  ChannelIdType,
  type ChannelList,
  type ClassType,
  isValidChannelTriplet,
  type MessageBus,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";

export const WithChannelList = <T extends ClassType<MessageBus.Type>>(Base: T) =>
  class extends Base implements ChannelList {
    channelListRef = IORef.newIORef<Channel[]>([])();

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        const channels = pipe(
          payload.channels,
          A.filter(isValidChannelTriplet),
          A.map((channel) => ({
            idType: ChannelIdType.ID_DVB_T,
            ...channel,
          })),
        );
        this.channelListRef.write(channels);
      });
    }

    get channelList(): Channel[] {
      return this.channelListRef.read();
    }

    get length(): number {
      return this.channelListRef.read().length;
    }

    item = (index: number) => pipe(this.channelListRef.read(), A.lookup(index), O.toNullable);

    getChannel = (ccid: string) =>
      pipe(
        this.channelListRef.read(),
        A.findFirst((channel) => channel.ccid === ccid),
        O.toNullable,
      );

    getChannelByTriplet = (onid: number, tsid: number, sid: number, _nid?: number) =>
      pipe(
        this.channelListRef.read(),
        A.findFirst((channel) => channel.onid === onid && channel.tsid === tsid && channel.sid === sid),
        O.toNullable,
      );
  };
