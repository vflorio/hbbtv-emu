import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as t from "io-ts";
import { ChannelIdType, ChannelTripletCodec, type Channel as FullChannel, isValidChannelTriplet } from "./hbbtv";

export namespace ExtensionConfig {
  const StreamEventCodec = t.intersection([
    t.type({
      id: t.string,
      name: t.string,
      eventName: t.string,
      data: t.string,
    }),
    t.partial({
      text: t.string,
      targetURL: t.string,
      cronSchedule: t.string,
      enabled: t.boolean,
    }),
  ]);

  export type StreamEvent = t.TypeOf<typeof StreamEventCodec>;

  const ChannelConfigCodec = t.intersection([
    ChannelTripletCodec,
    t.type({
      id: t.string,
      name: t.string,
      mp4Source: t.string,
    }),
    t.partial({
      streamEvents: t.array(StreamEventCodec),
      enableStreamEvents: t.boolean,
    }),
  ]);

  export type Channel = t.TypeOf<typeof ChannelConfigCodec>;

  export const StateCodec = t.type({
    version: t.string,
    countryCode: t.string,
    capabilities: t.string,
    channels: t.array(ChannelConfigCodec),
    currentChannel: t.union([ChannelConfigCodec, t.null]),
  });

  export type State = t.TypeOf<typeof StateCodec>;

  export const validateState = (data: unknown): E.Either<InvalidExtensionConfigStateError, State> =>
    pipe(
      StateCodec.decode(data),
      E.mapLeft(() => invalidExtensionConfigStateError(`Invalid ExtensionConfig.State: ${JSON.stringify(data)}`)),
    );

  export const toChannel = (channel: O.Option<ExtensionConfig.Channel>): O.Option<FullChannel> =>
    pipe(
      channel,
      O.filter(isValidChannelTriplet),
      O.map(({ onid, tsid, sid }) => ({
        idType: ChannelIdType.ID_DVB_T,
        onid,
        tsid,
        sid,
      })),
    );
}

export const DEFAULT_HBBTV_CONFIG: ExtensionConfig.State = {
  currentChannel: null,
  channels: [],
  version: "1.5.0",
  countryCode: "ITA",
  capabilities:
    "<profilelist>" +
    '<ui_profile name="OITF_HD_UIPROF+META_SI+META_EIT+TRICKMODE+RTSP+AVCAD+DRM+DVB_T">' +
    "<ext>" +
    "<colorkeys>true</colorkeys>" +
    '<video_broadcast type="ID_DVB_T" scaling="arbitrary" minSize="0">true</video_broadcast>' +
    '<parentalcontrol schemes="dvb-si">true</parentalcontrol>' +
    "</ext>" +
    '<drm DRMSystemID="urn:dvb:casystemid:19219">TS MP4</drm>' +
    '<drm DRMSystemID="urn:dvb:casystemid:1664" protectionGateways="ci+">TS</drm>' +
    "</ui_profile>" +
    '<audio_profile name="MPEG1_L3" type="audio/mpeg"/>' +
    '<audio_profile name="HEAAC" type="audio/mp4"/>' +
    '<video_profile name="TS_AVC_SD_25_HEAAC" type="video/mpeg"/>' +
    '<video_profile name="TS_AVC_HD_25_HEAAC" type="video/mpeg"/>' +
    '<video_profile name="MP4_AVC_SD_25_HEAAC" type="video/mp4"/>' +
    '<video_profile name="MP4_AVC_HD_25_HEAAC" type="video/mp4"/>' +
    '<video_profile name="MP4_AVC_SD_25_HEAAC" type="video/mp4" transport="dash"/>' +
    '<video_profile name="MP4_AVC_HD_25_HEAAC" type="video/mp4" transport="dash"/>' +
    "</profilelist>",
};

// Errors

export type InvalidExtensionConfigStateError = Readonly<{
  type: "InvalidExtensionConfigStateError";
  message: string;
}>;

export type ConfigContextError = Readonly<{
  type: "ConfigContextError";
  message: string;
}>;

export const invalidExtensionConfigStateError = (message: string): InvalidExtensionConfigStateError => ({
  type: "InvalidExtensionConfigStateError",
  message,
});

export const configContextError = (message: string): ConfigContextError => ({
  type: "ConfigContextError",
  message,
});
