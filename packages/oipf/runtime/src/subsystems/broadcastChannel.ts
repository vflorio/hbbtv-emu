import { OIPF } from "@hbb-emu/oipf-api";
import type { ChannelConfig } from "@hbb-emu/state";

export type BroadcastChannel = Pick<
  OIPF.DAE.Broadcast.Channel,
  | "idType"
  | "onid"
  | "tsid"
  | "sid"
  | "name"
  | "ccid"
  | "channelType"
  | "hidden"
  | "locked"
  | "favourite"
  | "scrambled"
  | "hybrid"
  | "fta"
>;

/**
 * An emulator channel (scenario) as the OIPF Channel a video/broadcast tunes to.
 * Until device profiles exist, every channel is a free-to-air, HbbTV-capable DVB-T TV service.
 */
export const toBroadcastChannel = (channel: ChannelConfig): BroadcastChannel => ({
  idType: OIPF.DAE.Broadcast.ChannelIdType.ID_DVB_T,
  onid: channel.onid,
  tsid: channel.tsid,
  sid: channel.sid,
  name: channel.name,
  ccid: channel.id,
  channelType: OIPF.DAE.Broadcast.ChannelType.TYPE_TV,
  hidden: false,
  locked: false,
  favourite: false,
  scrambled: false,
  hybrid: true,
  fta: true,
});

/** Two channels are the same service when their DVB triplets match (names and ids aside). */
export const isSameService = (
  a: Pick<OIPF.DAE.Broadcast.Channel, "onid" | "tsid" | "sid"> | null,
  b: Pick<OIPF.DAE.Broadcast.Channel, "onid" | "tsid" | "sid"> | null,
): boolean => a === b || (a !== null && b !== null && a.onid === b.onid && a.tsid === b.tsid && a.sid === b.sid);

/**
 * The channel the TV is tuned to when a page starts: the one the host says, or the
 * first of the lineup until it does.
 */
export const initialTunedChannel = (
  current: ChannelConfig | null,
  channels: ReadonlyArray<ChannelConfig>,
): OIPF.DAE.Broadcast.Channel | null => {
  const channel = current ?? channels[0] ?? null;
  // The OIPF Channel object has more members (methods, …) than the emulator fills in.
  return channel ? (toBroadcastChannel(channel) as OIPF.DAE.Broadcast.Channel) : null;
};
