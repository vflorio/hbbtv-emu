import { DEFAULT_LOGGER_STATE, type LoggerState } from "@hbb-emu/core";
import { type ChannelConfig, DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import {
  type AitApplicationId,
  applicationIdOf,
  autostartApplication,
  DEFAULT_HBBTV_STATE,
  type HbbTVState,
  signalsApplication,
} from "@hbb-emu/oipf-api";
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
 *   Its channel is the one the application is broadcast-related to; changing it (from
 *   the UI) only retunes the page. The application cannot change it.
 * - `tv`: the TV was turned on from the UI, on a channel of the lineup. Changing
 *   channel follows the AIT, as on a TV: the running application survives if the new
 *   channel signals it, otherwise the tab loads the new channel's autostart
 *   application (or the TV page, `tv.html`, when it has none).
 */
export type TvSession = Readonly<{
  mode: "app" | "tv";
  /** The channel the TV is tuned to (an id of the lineup). */
  channelId: string | null;
  /** The page the TV shows (the last one that started in the tab); `null` before any. */
  url: string | null;
  /** The application the TV started from the AIT (`tv` mode); `null` when it runs none. */
  app: AitApplicationId | null;
}>;

/** The page that shows a channel without application: the TV's own, `tv.html?channel=<id>`. */
export type TvPageUrl = (channelId: string) => string;

export const TV_PAGE = "tv.html";

export const tvPageUrl =
  (base: string): TvPageUrl =>
  (channelId) =>
    `${base}?channel=${encodeURIComponent(channelId)}`;

/** What a TV shows when it selects the channel: its autostart application, or the TV page. */
const selectService = (channel: ChannelConfig, tvPage: TvPageUrl): Readonly<{ url: string; app: TvSession["app"] }> => {
  const autostart = autostartApplication(channel.ait);
  return autostart === null
    ? { url: tvPage(channel.id), app: null }
    : { url: autostart.url, app: applicationIdOf(autostart) };
};

/** The TV turned on from the UI, on `channel`: the tab still has to load `url`. */
export const turnedOnSession = (channel: ChannelConfig, tvPage: TvPageUrl): TvSession & { url: string } => ({
  mode: "tv",
  channelId: channel.id,
  ...selectService(channel, tvPage),
});

/**
 * The session after a channel change, and the page the tab must load for it
 * (`null`: the page stays, it only retunes). See `TvSession` for the two modes.
 */
export const changeChannel = (
  session: TvSession,
  channel: ChannelConfig,
  tvPage: TvPageUrl,
): Readonly<{ session: TvSession; navigateTo: string | null }> => {
  const retuned = { ...session, channelId: channel.id };
  if (session.mode === "app" || (session.app !== null && signalsApplication(channel.ait, session.app))) {
    return { session: retuned, navigateTo: null };
  }
  const selected = selectService(channel, tvPage);
  return { session: { ...retuned, ...selected }, navigateTo: selected.url };
};

/**
 * Whether the application may change its TV to `channel` (`setChannel()`): only a
 * TV changes channel. An application opened on its own has only its channel
 * (ROADMAP D5).
 */
export const mayChangeChannel = (session: TvSession, channel: ChannelConfig): boolean =>
  session.mode === "tv" || session.channelId === channel.id;

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
  app: null,
});

export const findChannel = (state: ExtensionState, channelId: string): ChannelConfig | null =>
  state.runtime.channels.find((channel) => channel.id === channelId) ?? null;

/** The session's channel, or the default one if it was removed from the lineup. */
export const sessionChannel = (state: ExtensionState, session: TvSession): ChannelConfig | null =>
  (session.channelId === null ? null : findChannel(state, session.channelId)) ?? defaultChannel(state);

/**
 * The channel P+ (`step` 1) or P- (`step` -1) zaps the TV to: the next or previous
 * of the lineup, cycling at both ends; `null` with an empty lineup.
 */
export const zapChannel = (state: ExtensionState, session: TvSession, step: 1 | -1): ChannelConfig | null => {
  const channels = state.runtime.channels;
  if (channels.length === 0) return null;
  const current = sessionChannel(state, session);
  const index = channels.findIndex((channel) => channel.id === current?.id);
  const from = index === -1 ? (step === 1 ? -1 : 0) : index;
  return channels[(from + step + channels.length) % channels.length] ?? null;
};

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
