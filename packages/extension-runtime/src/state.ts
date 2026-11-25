import { DEFAULT_LOGGER_STATE, type LoggerState } from "@hbb-emu/core";
import { type ChannelConfig, DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { DEFAULT_HBBTV_STATE, type HbbTVState } from "@hbb-emu/oipf-api";
import type { PageConfig } from "@hbb-emu/protocol";

/**
 * Extension State Domain Types
 */

export type ExtensionState = {
  readonly version: number;
  readonly lastUpdated: number;
  readonly enabledTabIds: ReadonlySet<number>;
  readonly common: CommonSettings;
  readonly runtime: OipfRuntimeState;
  readonly logger: LoggerState;
};

export type OipfRuntimeState = {
  api: NonNullable<HbbTVState>;
  userAgent: string;
  channels: ReadonlyArray<ChannelConfig>;
  currentChannel: ChannelConfig | null;
};

export type CommonSettings = {
  readonly autoInjectHbbTV: boolean;
  readonly playerUiVisible: boolean;
};

export const DEFAULT_STATE: ExtensionState = {
  version: 1,
  lastUpdated: Date.now(),
  enabledTabIds: new Set(),
  common: {
    autoInjectHbbTV: true,
    playerUiVisible: false,
  },
  logger: DEFAULT_LOGGER_STATE,
  runtime: {
    api: DEFAULT_HBBTV_STATE,
    userAgent: DEFAULT_EXTENSION_STATE.userAgent,
    channels: DEFAULT_EXTENSION_STATE.channels,
    currentChannel: null,
  },
} as const;

/** The part of the state the page runtime needs (ROADMAP D5: configuration, not object state). */
export const toPageConfig = (state: ExtensionState): PageConfig => ({
  userAgent: state.runtime.userAgent,
  channels: state.runtime.channels,
});
