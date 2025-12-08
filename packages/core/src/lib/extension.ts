import * as t from "io-ts";
import { ChannelTripletCodec } from "../hbbtv";
import { DEFAULT_HBBTV_STATE, HbbTVStateCodec, StreamEventStateCodec } from "../hbbtv/model";
import { textToHex } from "./hex";
import { randomUUID } from "./misc";

// ─────────────────────────────────────────────────────────────────────────────
// Stream Event Config
// ─────────────────────────────────────────────────────────────────────────────

export const StreamEventConfigCodec = t.intersection([
  StreamEventStateCodec,
  t.type({
    id: t.string,
    enabled: t.boolean,
    delaySeconds: t.number, // Delay in secondi prima di questo evento (rispetto al precedente o all'inizio del ciclo)
  }),
]);

export type StreamEventConfig = t.TypeOf<typeof StreamEventConfigCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Channel Config
// ─────────────────────────────────────────────────────────────────────────────

export const ChannelConfigCodec = t.intersection([
  ChannelTripletCodec,
  t.type({
    id: t.string,
    name: t.string,
    mp4Source: t.string,
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

const streamEvent = (eventName: string, payload: string, delaySeconds: number): StreamEventConfig => ({
  id: randomUUID(),
  enabled: true,
  delaySeconds,
  eventName,
  targetURL: "http://localhost:8000",
  text: payload,
  data: textToHex(payload),
  status: "trigger",
});

export const DEFAULT_HBBTV_CONFIG: ExtensionState = {
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
        // Ciclo: PREP -> (10s) -> GO -> (10s) -> END -> (10s) -> PREP...
        streamEvent("PREP", dasEventPayload("1"), 10), // Dopo 10s dall'inizio/fine ciclo
        streamEvent("GO", dasEventPayload("2"), 10), // Dopo 10s da PREP
        streamEvent("END", dasEventPayload("3"), 10), // Dopo 10s da GO, poi ricomincia
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
