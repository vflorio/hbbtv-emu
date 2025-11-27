import type { Collection } from "./misc";

// Channel

export enum ChannelIdType {
  ID_ANALOG = 0,
  ID_DVB_C = 1,
  ID_DVB_S = 2,
  ID_DVB_T = 3,
  ID_DVB_SI_DIRECT = 13,
  ID_IPTV_SDS = 20,
  ID_IPTV_URI = 21,
  ID_ISDB_S = 30,
  ID_ISDB_T = 31,
  ID_ISDB_C = 32,
  ID_ATSC_T = 40,
}

export interface ChannelTriplet {
  onid: number;
  tsid: number;
  sid: number;
}

export const isValidChannelTriplet = (channel: unknown): channel is ChannelTriplet =>
  typeof channel === "object" &&
  channel !== null &&
  "onid" in channel &&
  "tsid" in channel &&
  "sid" in channel &&
  channel.onid === "number" &&
  channel.tsid === "number" &&
  channel.sid === "number";

export const serializeChannelTriplet = (triplet: ChannelTriplet) => `${triplet.onid}-${triplet.tsid}-${triplet.sid}`;

type ChannelExtention = {
  mp4Source?: string;
};

export interface Channel extends ChannelExtention, Partial<ChannelTriplet> {
  ccid?: string;
  name?: string;
  majorChannel?: number;
  minorChannel?: number;
  ipBroadcastID?: string;
  idType: ChannelIdType;
  sourceID?: number;
  dsd?: string;
  channelType?: number;
  nid?: number;
  channelMaxBitRate?: number;
  hidden?: boolean;
  manualBlock?: boolean;
  locked?: boolean;
}

export interface ParentalRating {
  scheme: string;
  region?: string;
  value: number;
  labels?: string[];
}

export interface Programme {
  programmeID: string;
  name: string;
  description?: string;
  longDescription?: string;
  startTime: number;
  duration: number;
  channelId: string;
  programmeIDType?: number;
  parentalRatings?: Collection<ParentalRating>;
}

export interface ChannelList {
  readonly length: number;
  item(index: number): Channel | null;
  getChannel(ccid: string): Channel | null;
  getChannelByTriplet(onid: number, tsid: number, sid: number, nid?: number): Channel | null;
}

export interface HbbTVChannelConfig {
  channelList: { readonly length: number; item(index: number): Channel | null };
  readonly favouriteLists?: unknown;
}

// Keyset

export interface Keyset {
  RED: number;
  GREEN: number;
  YELLOW: number;
  BLUE: number;
  NAVIGATION: number;
  VCR: number;
  SCROLL: number;
  INFO: number;
  NUMERIC: number;
  ALPHA: number;
  OTHER: number;
  value: number | null;
  setValue: (value: number) => void;
}

// Configuration

export interface Configuration {
  preferredAudioLanguage: string;
  preferredSubtitleLanguage: string;
  preferredUILanguage: string;
  countryId: string;
  subtitlesEnabled?: boolean;
  audioDescriptionEnabled?: boolean;
  timeShiftSynchronized?: boolean;
  dtt_network_ids?: string[];
  deviceId?: string;
  requestAccessToDistinctiveIdentifier?: (cb: (granted: boolean) => void) => void;
}

export interface LocalSystem {
  deviceID: string;
  modelName: string;
  vendorName: string;
  softwareVersion: string;
  hardwareVersion: string;
  serialNumber: string;
}

export interface OipfConfiguration {
  configuration: Configuration;
  localSystem?: LocalSystem;
  getText: (key: string) => string | undefined;
  setText: (key: string, value: string) => void;
}

// Capabilities

export interface OipfCapabilities {
  xmlCapabilities: Document;
  extraSDVideoDecodes: number;
  extraHDVideoDecodes: number;
  hasCapability: (capability: string) => boolean;
}

// Application

export interface ApplicationPrivateData {
  keyset: Keyset;
  currentChannel: Channel | null;
  getFreeMem: () => number;
}

export interface Application {
  visible: boolean | undefined;
  privateData: ApplicationPrivateData;
  show: () => boolean;
  hide: () => boolean;
  createApplication: (uri: string, createChild?: boolean) => void;
  destroyApplication: () => void;
}

// Object Factory

export interface OipfObjectFactory {
  isObjectSupported: (mimeType: string) => boolean;
  createVideoBroadcastObject: () => unknown;
  createApplicationManagerObject: () => unknown;
  createConfigurationObject: () => unknown;
  createCapabilitiesObject: () => unknown;
}

// Application Manager

export interface OipfApplicationManager {
  ownerApplication: Application;
  getOwnerApplication: (document: Document) => Application;
}

// OIPF

export interface Oipf {
  channelList: ChannelList;
  programmes: Programme[];
  getCurrentTVChannel: () => Channel;
}
