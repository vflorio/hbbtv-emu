/**
 * HbbTV State Model
 *
 * This module defines the complete state model for representing the HbbTV API state.
 * It uses io-ts codecs for runtime type validation and type inference.
 *
 * The state is organized hierarchically to mirror the OIPF/HbbTV API structure:
 * - oipfConfiguration: Device configuration settings
 * - oipfCapabilities: Device capabilities
 * - channelConfig: Channel list and favorites
 * - videoBroadcast: Current broadcast state
 * - avControl: A/V Control playback state
 */

import * as t from "io-ts";
import { ApplicationManagerStateCodec, DEFAULT_APPLICATION_MANAGER } from "./applicationManager";
import { AVControlStateCodec } from "./avControl";
import { ChannelConfigStateCodec, DEFAULT_CHANNEL_CONFIG } from "./channel";
import { DEFAULT_OIPF_CAPABILITIES, OipfCapabilitiesStateCodec } from "./oipfCapabilities";
import { DEFAULT_OIPF_CONFIGURATION, OipfConfigurationStateCodec } from "./oipfConfiguration";
import { DEFAULT_VIDEO_BROADCAST, VideoBroadcastStateCodec } from "./videoBroadcast";

// ─────────────────────────────────────────────────────────────────────────────
// HbbTV State Container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete HbbTV API state container.
 */
export const HbbTVStateCodec = t.partial({
  /** OIPF Application Manager state */
  applicationManager: ApplicationManagerStateCodec,

  /** OIPF Configuration object state */
  oipfConfiguration: OipfConfigurationStateCodec,

  /** OIPF Capabilities object state */
  oipfCapabilities: OipfCapabilitiesStateCodec,

  /** Channel configuration (channel list, favourites) */
  channelConfig: ChannelConfigStateCodec,

  /** Video/Broadcast object state */
  videoBroadcast: VideoBroadcastStateCodec,

  /** A/V Control objects state (keyed by object ID) */
  avControls: t.record(t.string, AVControlStateCodec),
});

export type HbbTVState = t.TypeOf<typeof HbbTVStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_AV_CONTROLS: NonNullable<HbbTVState["avControls"]> = {};

export const DEFAULT_HBBTV_STATE: NonNullable<HbbTVState> = {
  applicationManager: DEFAULT_APPLICATION_MANAGER,
  oipfConfiguration: DEFAULT_OIPF_CONFIGURATION,
  oipfCapabilities: DEFAULT_OIPF_CAPABILITIES,
  channelConfig: DEFAULT_CHANNEL_CONFIG,
  videoBroadcast: DEFAULT_VIDEO_BROADCAST,
  avControls: DEFAULT_AV_CONTROLS,
};
