/**
 * Channel State
 *
 * State for broadcast channels and channel configuration.
 *
 */

import * as t from "io-ts";
import {
  ChannelIdType as SpecChannelIdType,
  ChannelType as SpecChannelType,
} from "../../../specification/dae/videoBroadcast/channel";
import { enumCodec } from "../../enumCodec";

// ─────────────────────────────────────────────────────────────────────────────
// Channel ID Type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Channel identification type.
 * Maps to Broadcast.Channel.ChannelIdType enum values.
 */
export const ChannelIdTypeCodec = enumCodec<SpecChannelIdType>("ChannelIdType", SpecChannelIdType);

export type ChannelIdType = t.TypeOf<typeof ChannelIdTypeCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Channel Type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Channel type (TV, Radio, Other).
 */
export const ChannelTypeCodec = enumCodec<SpecChannelType>("ChannelType", SpecChannelType);

export type ChannelType = t.TypeOf<typeof ChannelTypeCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Channel State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State for a single broadcast channel.
 *
 * Contains all properties needed to identify and describe a channel.
 * Not all properties are required - presence depends on idType.
 */
export const ChannelStateCodec = t.intersection([
  t.type({
    /** Channel identification type (DVB-T, DVB-S, IPTV, etc.) */
    idType: ChannelIdTypeCodec,
  }),
  t.partial({
    /** Unique channel identifier */
    ccid: t.string,

    // DVB triplet (for DVB-* channel types)
    /** Original Network ID */
    onid: t.number,
    /** Transport Stream ID */
    tsid: t.number,
    /** Service ID */
    sid: t.number,

    // ATSC
    /** Source ID for ATSC channels */
    sourceID: t.number,

    // IPTV
    /** IP Broadcast ID or service URI */
    ipBroadcastID: t.string,

    // DVB-SI Direct
    /** Delivery System Descriptor */
    dsd: t.string,

    // Display properties
    /** Human-readable channel name */
    name: t.string,
    /** Major channel number */
    majorChannel: t.number,
    /** Minor channel number */
    minorChannel: t.number,
    /** Logical Channel Number (LCN) */
    channelNumber: t.number,
    /** Channel content type */
    channelType: ChannelTypeCodec,

    // Status flags
    /** Channel is hidden from UI */
    hidden: t.boolean,
    /** Channel is locked by parental control */
    locked: t.boolean,
    /** Channel is a favourite */
    favourite: t.boolean,
    /** Favourite list index */
    favouriteListIndex: t.number,
    /** Channel is scrambled/encrypted */
    scrambled: t.boolean,
    /** Channel supports HbbTV */
    hybrid: t.boolean,
    /** Free-to-air only */
    fta: t.boolean,

    // Metadata
    /** URI for channel logo */
    logoUri: t.string,
    /** Channel description */
    description: t.string,
    /** Channel genre */
    genre: t.string,
  }),
]);

export type ChannelState = t.TypeOf<typeof ChannelStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Favourite List State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Favourite list state.
 */
export const FavouriteListStateCodec = t.type({
  /** Unique identifier */
  id: t.string,
  /** List name */
  name: t.string,
  /** Channel ccids in this list */
  channelIds: t.array(t.string),
});

export type FavouriteListState = t.TypeOf<typeof FavouriteListStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Channel Config State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Channel configuration state.
 *
 * Contains the complete channel list and favourite lists.
 */
export const ChannelConfigStateCodec = t.partial({
  /** All available channels */
  channels: t.array(ChannelStateCodec),

  /** Favourite lists */
  favouriteLists: t.array(FavouriteListStateCodec),
});

export type ChannelConfigState = t.TypeOf<typeof ChannelConfigStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CHANNELS: NonNullable<ChannelConfigState["channels"]> = [];

export const DEFAULT_FAVOURITE_LISTS: NonNullable<ChannelConfigState["favouriteLists"]> = [];

export const DEFAULT_CHANNEL_CONFIG: NonNullable<ChannelConfigState> = {
  channels: DEFAULT_CHANNELS,
  favouriteLists: DEFAULT_FAVOURITE_LISTS,
};
