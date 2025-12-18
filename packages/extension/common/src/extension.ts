import { randomUUID, textToHex } from "@hbb-emu/core";
import { DEFAULT_HBBTV_STATE, HbbTVStateCodec, StreamEventStateCodec } from "@hbb-emu/oipf";
import * as t from "io-ts";

// ─────────────────────────────────────────────────────────────────────────────
// Stream Event Config
// ─────────────────────────────────────────────────────────────────────────────

export const StreamEventConfigCodec = t.intersection([
  StreamEventStateCodec,
  t.type({
    id: t.string,
    enabled: t.boolean,
  }),
  t.partial({
    label: t.string,
    scheduleMode: t.union([t.literal("timestamps"), t.literal("interval"), t.literal("delay")]),
    delaySeconds: t.number,
    atSeconds: t.number,
    intervalSeconds: t.number,
    offsetSeconds: t.number,
  }),
]);

export type StreamEventConfig = t.TypeOf<typeof StreamEventConfigCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Stream Event Scheduling (per channel)
// ─────────────────────────────────────────────────────────────────────────────

export const StreamEventScheduleModeCodec = t.union([
  t.literal("timestamps"),
  t.literal("interval"),
  t.literal("delay"),
]);

export type StreamEventScheduleMode = t.TypeOf<typeof StreamEventScheduleModeCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Channel Config
// ─────────────────────────────────────────────────────────────────────────────

export const ChannelConfigCodec = t.intersection([
  t.type({
    id: t.string,
    name: t.string,
    mp4Source: t.string,
    onid: t.number,
    tsid: t.number,
    sid: t.number,
  }),
  t.partial({
    streamEvents: t.array(StreamEventConfigCodec),
    enableStreamEvents: t.boolean,
  }),
]);

export type ChannelConfig = t.TypeOf<typeof ChannelConfigCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Extension State
// ─────────────────────────────────────────────────────────────────────────────

export const ExtensionStateCodec = t.intersection([
  t.type({
    userAgent: t.string,
    channels: t.array(ChannelConfigCodec),
    currentChannel: t.union([ChannelConfigCodec, t.null]),
  }),
  t.type({
    hbbtv: HbbTVStateCodec,
  }),
]);

export type ExtensionState = t.TypeOf<typeof ExtensionStateCodec>;

const dasEventPayload = (t: "1" | "2" | "3") =>
  JSON.stringify({
    p: "DAS", // Protocol: tipo di protocollo (Dynamic Ad Substitution)
    v: "1.1", // Version: versione del protocollo DAS
    t, // Type: tipo di evento (1 = inizio spot, 2 = fine spot, etc.)
    dI: "20241007RTIT000022100", // DAI ID: identificatore univoco della sessione DAI (data + broadcaster + ID)
    c: "RTIT", // Channel: codice del canale/broadcaster (RTIT = RAI Italia)
    bI: "000022100", // Break ID: identificatore del break pubblicitario
    mI: "EHD/552396B", // Media ID: identificatore del contenuto media/spot
    st: "1728325527000", // Start Time: timestamp di inizio in millisecondi (Unix epoch)
    du: "235000", // Duration: durata in millisecondi (235 secondi = ~3.9 minuti)
  });

const streamEvent = (
  label: string,
  payload: string,
  offsetSeconds: number,
  intervalSeconds = 30,
): StreamEventConfig => ({
  id: randomUUID(),
  enabled: true,
  label,
  scheduleMode: "interval",
  intervalSeconds,
  offsetSeconds,
  eventName: "sevent",
  targetURL: "http://dev-container.enhanced.tools/it/default.ste",
  text: payload,
  data: textToHex(payload),
  status: "trigger",
});

export const DEFAULT_EXTENSION_STATE: ExtensionState = {
  currentChannel: null,
  channels: [
    {
      id: "channel-1",
      name: "Channel 1",
      mp4Source: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      onid: 1,
      tsid: 1,
      sid: 1,
      enableStreamEvents: true,
      streamEvents: [
        streamEvent("PREP", dasEventPayload("1"), 0, 30), // ogni 30s, offset 0s
        streamEvent("GO", dasEventPayload("2"), 10, 30), // ogni 30s, offset 10s
        streamEvent("END", dasEventPayload("3"), 20, 30), // ogni 30s, offset 20s
      ],
    },
  ],
  userAgent: "Mozilla/5.0 (SmartTV; HbbTV/1.5.1 (+DL;Vendor/ModelName;0.0.1;0.0.1;) CE-HTML/1.0 NETRANGEMMH",
  hbbtv: DEFAULT_HBBTV_STATE,
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
