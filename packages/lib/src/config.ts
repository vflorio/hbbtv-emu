import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import { ChannelIdType, type ChannelTriplet, type Channel as FullChannel, isValidChannelTriplet } from "./hbbtv";

export namespace ExtensionConfig {
  export type State = {
    version: string;
    countryCode: string;
    capabilities: string;
    channels: Channel[];
    currentChannel: Channel | null;
  };

  export type StreamEvent = {
    id: string;
    name: string;
    eventName: string;
    data: string;
    text?: string;
    targetURL?: string;
    cronSchedule?: string;
    enabled?: boolean;
  };

  export type Channel = ChannelTriplet & {
    id: string;
    name: string;
    mp4Source: string;
    streamEvents?: StreamEvent[];
    enableStreamEvents?: boolean;
  };

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
