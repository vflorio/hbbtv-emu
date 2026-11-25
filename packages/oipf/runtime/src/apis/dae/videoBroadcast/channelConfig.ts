/**
 * video/broadcast — the channel lineup as the application sees it
 *
 * `getChannelConfig()` (OIPF DAE §7.13.9) returns a `ChannelConfig` whose
 * `channelList` (§7.13.10) is the TV's lineup. HbbTV terminals expose `channelList`
 * only; favourite lists are left out.
 *
 * The order is the lineup's, which is also what `nextChannel()` / `prevChannel()`
 * follow, until channels have a logical channel number.
 */

import type { OIPF } from "@hbb-emu/oipf-api";
import * as O from "fp-ts/Option";
import { isSameService } from "../../../subsystems";

type Channel = OIPF.DAE.Broadcast.Channel;

/** A `ChannelList`: `length`, `item()`, index access, and lookups by ccid and DVB triplet. */
export const createChannelList = (channels: ReadonlyArray<Channel>): OIPF.DAE.Broadcast.ChannelList => {
  const list: OIPF.DAE.Broadcast.ChannelList = {
    length: channels.length,
    item: (index) => channels[index],
    getChannel: (ccid) => channels.find((channel) => channel.ccid === ccid) ?? null,
    getChannelByTriplet: (onid, tsid, sid) =>
      channels.find((channel) => isSameService(channel, { onid, tsid, sid })) ?? null,
  };
  channels.forEach((channel, index) => {
    list[index] = channel;
  });
  return list;
};

export const createChannelConfig = (channels: ReadonlyArray<Channel>): OIPF.DAE.Broadcast.ChannelConfig => ({
  channelList: createChannelList(channels),
});

export type Step = 1 | -1;

/**
 * The channel `step` places away from `current` in the lineup, cycling at both ends
 * (OIPF DAE §7.13.1.3, `nextChannel()` / `prevChannel()`). From a channel outside the
 * lineup (implementation dependent), the first one going forward and the last going
 * back. None with an empty lineup.
 */
export const neighbourChannel = (
  channels: ReadonlyArray<Channel>,
  current: Channel | null,
  step: Step,
): O.Option<Channel> => {
  const count = channels.length;
  if (count === 0) return O.none;
  const index = channels.findIndex((channel) => isSameService(channel, current));
  const from = index === -1 ? (step === 1 ? -1 : 0) : index;
  return O.fromNullable(channels[(from + step + count) % count]);
};
