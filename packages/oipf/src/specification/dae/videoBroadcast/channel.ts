/**
 * HbbTV Channel API
 *
 * Defines the Channel and ChannelConfig interfaces for broadcast channel
 * management in HbbTV applications.
 *
 * @see OIPF DAE Specification Section 7.13
 * @see HbbTV Specification
 */

// ============================================================================
// Channel ID Types
// ============================================================================

/**
 * Channel identification type constants.
 *
 * These constants identify the type of channel and determine which
 * properties are used for channel identification.
 */
export enum ChannelIdType {
  /** DVB-C (Cable) channel identified by DVB triplet */
  ID_DVB_C = 0,

  /** DVB-S (Satellite) channel identified by DVB triplet */
  ID_DVB_S = 1,

  /** DVB-T (Terrestrial) channel identified by DVB triplet */
  ID_DVB_T = 2,

  /** DVB-C2 (Cable second generation) channel */
  ID_DVB_C2 = 3,

  /** DVB-S2 (Satellite second generation) channel */
  ID_DVB_S2 = 4,

  /** DVB-T2 (Terrestrial second generation) channel */
  ID_DVB_T2 = 5,

  /** ATSC-T channel identified by source_ID */
  ID_ATSC_T = 10,

  /** Analogue channel */
  ID_ANALOG = 11,

  /** IPTV channel via SDS (Service Discovery and Selection) */
  ID_IPTV_SDS = 12,

  /**
   * DVB-SI direct channel.
   *
   * Channel identified by delivery system descriptor and service ID.
   * Created via createChannelObject() with tuning parameters.
   */
  ID_DVB_SI_DIRECT = 13,

  /** IPTV channel via URI */
  ID_IPTV_URI = 14,

  /** ISDB-C channel */
  ID_ISDB_C = 20,

  /** ISDB-S channel */
  ID_ISDB_S = 21,

  /** ISDB-T channel */
  ID_ISDB_T = 22,
}

/**
 * Channel type constants indicating the nature of the channel content.
 */
export enum ChannelType {
  /** Television channel */
  TYPE_TV = 0,

  /** Radio channel */
  TYPE_RADIO = 1,

  /** Other/data channel */
  TYPE_OTHER = 2,
}

// ============================================================================
// Channel Interface
// ============================================================================

/**
 * Represents a broadcast channel.
 *
 * A Channel object contains all the information necessary to tune to and
 * identify a broadcast channel. The properties available depend on the
 * channel's `idType`.
 *
 * Channel objects can be obtained from:
 * - `ChannelConfig.channelList`
 * - `VideoBroadcast.currentChannel`
 * - `VideoBroadcast.createChannelObject()`
 * - `ChannelConfig.getChannelWithTriplet()`
 */
export interface Channel {
  /**
   * The type of channel identification.
   *
   * Determines which properties are used to identify the channel.
   *
   * @see ChannelIdType
   */
  readonly idType: ChannelIdType;

  /**
   * Unique identifier of the channel within the channel list.
   *
   * For channels obtained from the channel list, this is a stable identifier.
   * For locally created channels, this may be undefined.
   *
   * The ccid is implementation-specific and should not be parsed.
   */
  readonly ccid?: string;

  /**
   * The original network ID (DVB triplet component).
   *
   * Available for channels with idType ID_DVB_*, ID_IPTV_URI, or ID_ISDB_*.
   */
  readonly onid?: number;

  /**
   * The transport stream ID (DVB triplet component).
   *
   * Available for channels with idType ID_DVB_*, ID_IPTV_URI, or ID_ISDB_*.
   */
  readonly tsid?: number;

  /**
   * The service ID (DVB triplet component).
   *
   * Available for channels with idType ID_DVB_*, ID_IPTV_URI, or ID_ISDB_*.
   */
  readonly sid?: number;

  /**
   * The source ID for ATSC channels.
   *
   * Available for channels with idType ID_ATSC_T.
   */
  readonly sourceID?: number;

  /**
   * The DVB textual service identifier or URI for IP channels.
   *
   * For ID_IPTV_SDS: Format is "ServiceName.DomainName"
   * For ID_IPTV_URI: The URI of the IP broadcast service
   */
  readonly ipBroadcastID?: string;

  /**
   * The delivery system descriptor for ID_DVB_SI_DIRECT channels.
   *
   * Contains tuning parameters as a Latin-1 encoded string where each
   * character represents a byte of the descriptor as defined in
   * ETSI EN 300 468.
   */
  readonly dsd?: string;

  /**
   * The name of the channel.
   *
   * Human-readable name for display purposes.
   */
  readonly name?: string;

  /**
   * The major channel number.
   *
   * For channels using major.minor numbering scheme.
   */
  readonly majorChannel?: number;

  /**
   * The minor channel number.
   *
   * For channels using major.minor numbering scheme.
   */
  readonly minorChannel?: number;

  /**
   * The logical channel number (LCN).
   *
   * The position of this channel in the channel list or EPG.
   * This is the number users typically use to tune to the channel.
   */
  readonly channelNumber?: number;

  /**
   * The type of channel content.
   *
   * @see ChannelType
   */
  readonly channelType?: ChannelType;

  /**
   * Indicates whether the channel is hidden.
   *
   * Hidden channels may not appear in the channel list UI.
   */
  readonly hidden?: boolean;

  /**
   * Indicates whether the channel is locked by parental control.
   */
  readonly locked?: boolean;

  /**
   * Indicates whether the channel is marked as a favourite.
   */
  readonly favourite?: boolean;

  /**
   * The index of the favourite list containing this channel.
   *
   * Only present if the channel is in a favourite list.
   */
  readonly favouriteListIndex?: number;

  /**
   * Indicates whether the channel is manually installed.
   *
   * As opposed to being installed automatically during a channel scan.
   */
  readonly manualBlock?: boolean;

  /**
   * Indicates whether the channel has Hybrid Broadcast capabilities.
   */
  readonly hybrid?: boolean;

  /**
   * Indicates whether the channel supports Free-to-Air services only.
   */
  readonly fta?: boolean;

  /**
   * The URI for the channel logo/icon.
   */
  readonly logoUri?: string;

  /**
   * The description of the channel.
   */
  readonly description?: string;

  /**
   * The genre of the channel content.
   */
  readonly genre?: string;

  /**
   * Indicates whether the channel is scrambled/encrypted.
   */
  readonly scrambled?: boolean;
}

// ============================================================================
// Channel List Interface
// ============================================================================

/**
 * Collection of Channel objects.
 *
 * Provides array-like access to channels with additional query methods.
 */
export interface ChannelList {
  /**
   * The number of channels in the list.
   */
  readonly length: number;

  /**
   * Returns the channel at the specified index.
   *
   * @param index - The zero-based index
   * @returns The Channel at the index, or undefined if out of bounds
   */
  item(index: number): Channel | undefined;

  /**
   * Returns the channel with the specified ccid.
   *
   * @param ccid - The channel's unique identifier
   * @returns The Channel with the ccid, or undefined if not found
   */
  getChannel(ccid: string): Channel | undefined;

  /**
   * Returns the channel with the specified DVB triplet.
   *
   * @param onid - Original network ID
   * @param tsid - Transport stream ID
   * @param sid - Service ID
   * @returns The matching Channel, or undefined if not found
   */
  getChannelByTriplet(onid: number, tsid: number, sid: number): Channel | undefined;

  /**
   * Array-like index access.
   */
  [index: number]: Channel;
}

// ============================================================================
// Favourite List Interface
// ============================================================================

/**
 * Represents a list of favourite channels.
 */
export interface FavouriteList {
  /**
   * The unique identifier of the favourite list.
   */
  readonly id: string;

  /**
   * The name of the favourite list.
   */
  readonly name: string;

  /**
   * The channels in this favourite list.
   */
  readonly channels: ChannelList;
}

/**
 * Collection of FavouriteList objects.
 */
export interface FavouriteListCollection {
  /**
   * The number of favourite lists.
   */
  readonly length: number;

  /**
   * Returns the favourite list at the specified index.
   *
   * @param index - The zero-based index
   * @returns The FavouriteList at the index, or undefined if out of bounds
   */
  item(index: number): FavouriteList | undefined;

  /**
   * Returns the favourite list with the specified ID.
   *
   * @param id - The favourite list's unique identifier
   * @returns The FavouriteList with the ID, or undefined if not found
   */
  getFavouriteList(id: string): FavouriteList | undefined;

  /**
   * Array-like index access.
   */
  [index: number]: FavouriteList;
}

// ============================================================================
// Channel Config Interface
// ============================================================================

/**
 * Provides access to the channel line-up and configuration.
 *
 * Obtained via `VideoBroadcast.getChannelConfig()`.
 */
export interface ChannelConfig {
  /**
   * The complete list of channels available to the terminal.
   */
  readonly channelList: ChannelList;

  /**
   * The collection of favourite lists.
   */
  readonly favouriteLists: FavouriteListCollection;

  /**
   * The currently active favourite list.
   *
   * When set, `prevChannel()` and `nextChannel()` will navigate
   * within this list instead of the full channel list.
   *
   * Set to `null` to use the full channel list.
   */
  currentFavouriteList: FavouriteList | null;

  /**
   * Returns the channel with the specified DVB triplet.
   *
   * @param idType - The type of channel (one of ID_DVB_* or ID_ISDB_*)
   * @param onid - Original network ID
   * @param tsid - Transport stream ID
   * @param sid - Service ID
   *
   * @returns The matching Channel, or `null` if not found
   */
  getChannelWithTriplet(idType: ChannelIdType, onid: number, tsid: number, sid: number): Channel | null;

  /**
   * Returns the channel at the specified position in the channel list.
   *
   * @param channelNumber - The logical channel number
   * @returns The Channel at that position, or `null` if not found
   */
  getChannelByNumber(channelNumber: number): Channel | null;
}
