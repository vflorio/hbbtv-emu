import { DEFAULT_LOGGER_STATE, type LoggerState } from "@hbb-emu/core";
import { type ChannelConfig, DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { DEFAULT_HBBTV_STATE, type HbbTVState } from "@hbb-emu/oipf-api";
import { type BootstrapData, initialChannel, type PageConfig, type PageSession, type UiState } from "@hbb-emu/protocol";

/**
 * Extension State Domain Types
 */

export type ExtensionState = {
  readonly version: number;
  readonly lastUpdated: number;
  readonly common: CommonSettings;
  readonly runtime: OipfRuntimeState;
  readonly logger: LoggerState;
};

export type OipfRuntimeState = {
  api: NonNullable<HbbTVState>;
  userAgent: string;
  channels: ReadonlyArray<ChannelConfig>;
};

export type CommonSettings = {
  readonly autoInjectHbbTV: boolean;
  readonly playerUiVisible: boolean;
};

export const DEFAULT_STATE: ExtensionState = {
  version: 1,
  lastUpdated: Date.now(),
  common: {
    autoInjectHbbTV: true,
    playerUiVisible: false,
  },
  logger: DEFAULT_LOGGER_STATE,
  runtime: {
    api: DEFAULT_HBBTV_STATE,
    userAgent: DEFAULT_EXTENSION_STATE.userAgent,
    channels: DEFAULT_EXTENSION_STATE.channels,
  },
} as const;

/** The part of the state the page runtime needs (ROADMAP D5: configuration, not object state). */
export const toPageConfig = (state: ExtensionState): PageConfig => ({
  userAgent: state.runtime.userAgent,
  channels: state.runtime.channels,
});

// ─────────────────────────────────────────────────────────────────────────────
// TV sessions (ROADMAP D5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One TV per tab: what the TV is doing, beyond the shared configuration. It lives
 * as long as the tab and outlives the pages loaded in it.
 *
 * - `app`: the tab was opened on an HbbTV application (detected by its content type).
 *   Its channel is the one the application is broadcast-related to.
 */
export type TvSession = Readonly<{
  mode: "app";
  /** The channel the TV is tuned to (an id of the lineup). */
  channelId: string | null;
  /** The page the TV shows (the last one that started in the tab); `null` before any. */
  url: string | null;
}>;

/** Every open TV, by tab id. */
export type TvSessions = Readonly<Record<string, TvSession>>;

/** Until device profiles exist, a TV is on the first channel of the lineup when nothing else says. */
export const defaultChannel = (state: ExtensionState): ChannelConfig | null => state.runtime.channels[0] ?? null;

/** What every page finds at `document_start`: the configuration, and the page each TV shows on which channel. */
export const toBootstrapData = (state: ExtensionState, sessions: TvSessions): BootstrapData => ({
  config: toPageConfig(state),
  tunings: Object.values(sessions).flatMap((session) => {
    const channel = sessionChannel(state, session);
    return session.url === null || channel === null ? [] : [{ url: session.url, channelId: channel.id }];
  }),
});

/**
 * The TV of a tab whose first HbbTV page is `url`: on the channel `initialChannel`
 * gives, with the data the page itself got at `document_start`, so the two agree
 * (the TV already showing that page, else the channel signalling it, else the first).
 */
export const newSession = (state: ExtensionState, sessions: TvSessions, url: string): TvSession => ({
  mode: "app",
  channelId: initialChannel(toBootstrapData(state, sessions), url)?.id ?? null,
  url,
});

export const findChannel = (state: ExtensionState, channelId: string): ChannelConfig | null =>
  state.runtime.channels.find((channel) => channel.id === channelId) ?? null;

/** The session's channel, or the default one if it was removed from the lineup. */
export const sessionChannel = (state: ExtensionState, session: TvSession): ChannelConfig | null =>
  (session.channelId === null ? null : findChannel(state, session.channelId)) ?? defaultChannel(state);

export const toPageSession = (state: ExtensionState, session: TvSession): PageSession => ({
  channel: sessionChannel(state, session),
});

/**
 * The snapshot the settings UI edits. `currentChannel` is the channel of the TV the
 * user is looking at (the active tab), `null` when that tab is not a TV.
 */
export const toUiState = (state: ExtensionState, currentChannel: ChannelConfig | null = null): UiState => ({
  userAgent: state.runtime.userAgent,
  channels: [...state.runtime.channels],
  currentChannel,
  playerUiVisible: state.common.playerUiVisible,
  hbbtv: state.runtime.api,
});

/**
 * Applies a UI snapshot onto the stored state (everything the UI does not edit is kept).
 * The current channel belongs to a tab's session, never to the shared state.
 */
export const fromUiState = (state: ExtensionState, ui: UiState): ExtensionState => ({
  ...state,
  common: { ...state.common, playerUiVisible: ui.playerUiVisible },
  runtime: {
    ...state.runtime,
    userAgent: ui.userAgent,
    channels: ui.channels,
    api: ui.hbbtv,
  },
});
