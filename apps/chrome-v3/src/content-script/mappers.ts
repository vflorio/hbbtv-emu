/**
 * Type Mappers
 *
 * Converts between extension and OIPF domain types.
 */

import type { ChannelConfig } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

/**
 * Maps ChannelConfig (extension state) to OIPF Channel partial state.
 *
 * ChannelConfig is a simplified channel representation used in the extension UI.
 * OIPF Channel requires additional properties like idType.
 *
 * This mapper provides the minimal set of properties needed to set currentChannel
 * in VideoBroadcast state.
 *
 * @param channel - Extension channel config
 * @returns Partial OIPF channel state suitable for VideoBroadcast.currentChannel
 */
export const mapChannelConfigToOIPFChannel = (
  channel: ChannelConfig,
): Pick<
  NonNullable<OIPF.DAE.Broadcast.VideoBroadcast["currentChannel"]>,
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
> =>
  pipe(
    IO.of({
      // Required idType - assume DVB-T (most common)
      // Runtime should infer this from triplet or provide channel registry lookup
      idType: 2 as const, // ID_DVB_T

      // DVB triplet from config
      onid: channel.onid,
      tsid: channel.tsid,
      sid: channel.sid,

      // Display name
      name: channel.name,

      // Derived from extension config ID
      ccid: channel.id,

      // Defaults for TV channel
      channelType: 0 as const, // TYPE_TV
      hidden: false,
      locked: false,
      favourite: false,
      scrambled: false,
      hybrid: true, // Assume HbbTV capable
      fta: true, // Assume free-to-air
    }),
  )();
