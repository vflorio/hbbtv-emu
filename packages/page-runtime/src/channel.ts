import type { ChannelConfig } from "@hbb-emu/extension-common";
import { OIPF } from "@hbb-emu/oipf-api";

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
