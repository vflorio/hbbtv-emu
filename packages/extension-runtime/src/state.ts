import { DEFAULT_LOGGER_STATE, type LoggerState } from "@hbb-emu/core";
import { DEFAULT_HBBTV_STATE, type HbbTVState } from "@hbb-emu/oipf-api";

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
  channels: any[];
  currentChannel: any;
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
    userAgent: "",
    channels: [],
    currentChannel: null,
  },
} as const;
