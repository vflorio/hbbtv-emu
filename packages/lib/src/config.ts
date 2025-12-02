import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as t from "io-ts";
import { ChannelIdType, ChannelTripletCodec, type Channel as FullChannel, isValidChannelTriplet } from "./hbbtv";
import { textToHex } from "./hex";

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
    userAgent: t.string,
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

const sampleDasPayload = JSON.stringify({
  value: {
    text: JSON.stringify({
      p: "DAS", // Protocol: tipo di protocollo (Dynamic Ad Substitution)
      v: "1.1", // Version: versione del protocollo DAS
      t: "1", // Type: tipo di evento (1 = inizio spot, 2 = fine spot, etc.)
      dI: "20241007RTIT000022100", // DAI ID: identificatore univoco della sessione DAI (data + broadcaster + ID)
      c: "RTIT", // Channel: codice del canale/broadcaster (RTIT = RAI Italia)
      bI: "000022100", // Break ID: identificatore del break pubblicitario
      mI: "EHD/552396B", // Media ID: identificatore del contenuto media/spot
      st: "1728325527000", // Start Time: timestamp di inizio in millisecondi (Unix epoch)
      du: "235000", // Duration: durata in millisecondi (235 secondi = ~3.9 minuti)
    }),
  },
});

export const DEFAULT_HBBTV_CONFIG: ExtensionConfig.State = {
  currentChannel: null,
  channels: [
    {
      id: "channel-1",
      name: "Channel 1",
      mp4Source: "https://www.w3schools.com/html/mov_bbb.mp4",
      onid: 1,
      tsid: 1,
      sid: 1,
      enableStreamEvents: true,
      streamEvents: [
        {
          id: "stream-event-1",
          name: "Stream Event 1",
          eventName: "event1",
          targetURL: "dvb://current.ait",
          enabled: true,
          cronSchedule: "*/1 * * * *", // Every 5 minutes
          text: sampleDasPayload,
          data: textToHex(sampleDasPayload),
        },
      ],
    },
  ],
  version: "1.5.0",
  countryCode: "ITA",
  userAgent: "Mozilla/5.0 (SmartTV; HbbTV/1.5.1 (+DL;Vendor/ModelName;0.0.1;0.0.1;) CE-HTML/1.0 NETRANGEMMH",
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
