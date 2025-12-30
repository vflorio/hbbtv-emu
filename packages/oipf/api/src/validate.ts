import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { ChannelIdType } from "./specification/dae/videoBroadcast/channel";

// TODO: Mergiare a model/dae/videoBroadcast/channel.ts

export const ChannelCodec = t.intersection([
  t.type({
    idType: t.union([
      t.literal(ChannelIdType.ID_DVB_C),
      t.literal(ChannelIdType.ID_DVB_S),
      t.literal(ChannelIdType.ID_DVB_T),
      t.literal(ChannelIdType.ID_DVB_SI_DIRECT),
      t.literal(ChannelIdType.ID_IPTV_SDS),
      t.literal(ChannelIdType.ID_IPTV_URI),
      t.literal(ChannelIdType.ID_ISDB_S),
      t.literal(ChannelIdType.ID_ISDB_T),
      t.literal(ChannelIdType.ID_ISDB_C),
      t.literal(ChannelIdType.ID_ATSC_T),
    ]),
  }),
  t.partial({
    onid: t.number,
    tsid: t.number,
    sid: t.number,
    ccid: t.string,
    name: t.string,
    majorChannel: t.number,
    minorChannel: t.number,
    ipBroadcastID: t.string,
    sourceID: t.number,
    dsd: t.string,
    channelType: t.number,
    nid: t.number,
    channelMaxBitRate: t.number,
    hidden: t.boolean,
    manualBlock: t.boolean,
    locked: t.boolean,
  }),
]);

export type Channel = t.TypeOf<typeof ChannelCodec>;

export type InvalidChannelError = Readonly<{
  type: "InvalidChannelError";
  message: string;
}>;

export const invalidChannelError = (message: string): InvalidChannelError => ({
  type: "InvalidChannelError",
  message,
});

export const validateChannel = (data: unknown): E.Either<InvalidChannelError, Channel> =>
  pipe(
    ChannelCodec.decode(data),
    E.mapLeft(() => invalidChannelError(`Invalid channel: ${JSON.stringify(data)}`)),
  );
