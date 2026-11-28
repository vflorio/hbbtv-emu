import { emulatorAsset, randomUUID, textToHex } from "@hbb-emu/core";
import {
  AitCodec,
  DEFAULT_HBBTV_STATE,
  emulatorUserAgent,
  HbbTVStateCodec,
  StreamEventStateCodec,
} from "@hbb-emu/oipf-api";
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
    /** The applications the channel signals; none: the TV shows the broadcast alone. */
    ait: AitCodec,
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
    playerUiVisible: t.boolean,
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

/**
 * DMAX Italia's application: the "enhanced" container, the reference application of the
 * emulator. It listens for the stream event `sevent` of this DSM-CC description.
 */
const DMAX_APP_URL = "http://it.container.enhanced.live/dmax";
const DMAX_STREAM_EVENTS_URL = "http://it.container.enhanced.live/it/default.ste";

/**
 * The broadcast's stand-in: a 60 s test card the emulator ships (VP9 and silent Opus in MP4,
 * a timecode in its corner), looped from the channel's epoch by the live simulation, so it is
 * where a broadcast would be. No external service to depend on (the DASH-IF live simulator,
 * the previous stand-in, limits its requests).
 */
export const BROADCAST_STAND_IN = emulatorAsset("broadcast/test-card.mp4");

/**
 * Off by default: they would reach the production ad substitution of the real application, with
 * made-up break ids. Enabled from the UI when testing DAI.
 */
const streamEvent = (
  label: string,
  payload: string,
  offsetSeconds: number,
  intervalSeconds = 30,
): StreamEventConfig => ({
  id: randomUUID(),
  enabled: false,
  label,
  scheduleMode: "interval",
  intervalSeconds,
  offsetSeconds,
  eventName: "sevent",
  targetURL: DMAX_STREAM_EVENTS_URL,
  text: payload,
  data: textToHex(payload),
  status: "trigger",
});

export const DEFAULT_EXTENSION_STATE: ExtensionState = {
  currentChannel: null,
  playerUiVisible: false,
  channels: [
    {
      id: "channel-1",
      name: "Channel 1",
      mp4Source: BROADCAST_STAND_IN,
      onid: 1,
      tsid: 1,
      sid: 1,
    },
    {
      id: "dmax",
      name: "DMAX",
      mp4Source: BROADCAST_STAND_IN,
      // DMAX Italia's service, as its application knows it (its linear configuration).
      onid: 12289,
      tsid: 516,
      sid: 10,
      // orgId/appId are the emulator's: the real ones are in the broadcast AIT, not yet captured.
      ait: { applications: [{ orgId: 1, appId: 1, controlCode: "AUTOSTART", url: DMAX_APP_URL, name: "DMAX" }] },
      enableStreamEvents: true,
      streamEvents: [
        streamEvent("PREP", dasEventPayload("1"), 5, 90), // ogni 90s, offset 5s
        streamEvent("GO", dasEventPayload("2"), 10, 90), // ogni 90s, offset 10s
        streamEvent("END", dasEventPayload("3"), 40, 90), // ogni 90s, offset 40s
      ],
    },
  ],
  // TS 102 796 §7.3.2.4, for the HbbTV version of the capabilities.
  userAgent: emulatorUserAgent(DEFAULT_HBBTV_STATE.oipfCapabilities?.hbbtvVersion),
  hbbtv: DEFAULT_HBBTV_STATE,
};
