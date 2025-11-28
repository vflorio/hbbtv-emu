import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
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

export const ChannelTripletCodec = t.type({
  onid: t.number,
  tsid: t.number,
  sid: t.number,
});

export type ChannelTriplet = t.TypeOf<typeof ChannelTripletCodec>;

export type InvalidChannelTripletError = Readonly<{
  type: "InvalidChannelTripletError";
  message: string;
}>;

export const invalidChannelTripletError = (message: string): InvalidChannelTripletError => ({
  type: "InvalidChannelTripletError",
  message,
});

export const validateChannelTriplet = (data: unknown): E.Either<InvalidChannelTripletError, ChannelTriplet> =>
  pipe(
    ChannelTripletCodec.decode(data),
    E.mapLeft(() => invalidChannelTripletError(`Invalid channel triplet: ${JSON.stringify(data)}`)),
  );

export const isValidChannelTriplet = (channel: unknown): channel is ChannelTriplet =>
  E.isRight(ChannelTripletCodec.decode(channel));

export const serializeChannelTriplet = (triplet: ChannelTriplet) => `${triplet.onid}-${triplet.tsid}-${triplet.sid}`;

export const ChannelCodec = t.intersection([
  t.type({
    idType: t.union([
      t.literal(ChannelIdType.ID_ANALOG),
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

export enum ChannelChangeError {
  CHANNEL_NOT_SUPPORTED = 0,
  CANNOT_TUNE = 1,
  TUNER_LOCKED = 2,
  PARENTAL_LOCK = 3,
  ENCRYPTED_NO_KEY = 4,
  UNKNOWN_CHANNEL = 5,
  INTERRUPTED = 6,
  RECORDING = 7,
  CANNOT_RESOLVE_URI = 8,
  INSUFFICIENT_BANDWIDTH = 9,
  NO_CHANNEL_LIST = 10,
  INSUFFICIENT_RESOURCES = 11,
  CHANNEL_NOT_IN_TS = 12,
  UNIDENTIFIED_ERROR = 100,
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

export interface ChannelConfig {
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
