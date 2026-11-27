import { DEFAULT_LOGGER_STATE, type LoggerState, resolveEmulatorAsset } from "@hbb-emu/core";
import { type ChannelConfig, DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import {
  type AitApplicationId,
  applicationIdOf,
  applicationLocation,
  autostartApplication,
  DEFAULT_HBBTV_STATE,
  type HbbTVState,
  parseDvbApplicationUrl,
  signalledApplication,
  signalsApplication,
} from "@hbb-emu/oipf-api";
import {
  type BootstrapData,
  initialChannel,
  type PageConfig,
  type PageSession,
  tunedChannelId,
  type UiState,
} from "@hbb-emu/protocol";

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

/** The URL, on the host, of a file the emulator ships at a path (`AssetsAdapter`). */
export type AssetUrl = (path: string) => string;

/**
 * The part of the state the page runtime needs (ROADMAP D5: configuration, not object
 * state), with the files the emulator ships at their URL on the host (`emulatorAsset`).
 */
export const toPageConfig = (state: ExtensionState, assetUrl: AssetUrl): PageConfig => ({
  userAgent: state.runtime.userAgent,
  channels: state.runtime.channels.map((channel) => toPageChannel(channel, assetUrl)),
});

/** A channel as pages get it: its stream at its URL on the host. */
const toPageChannel = (channel: ChannelConfig, assetUrl: AssetUrl): ChannelConfig => ({
  ...channel,
  mp4Source: resolveEmulatorAsset(channel.mp4Source, assetUrl),
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
  /** The channel the TV is tuned to (an id of the lineup), or was before it selected none. */
  channelId: string | null;
  /**
   * Whether the TV selects that channel's service: `false` while a broadcast-independent
   * application runs, the "null service" of TS 102 796 §6.2.2.6.1 (no broadcast, no
   * current channel). Selecting a channel selects it again.
   */
  serviceSelected: boolean;
  /** The page the TV shows (the last one that started in the tab); `null` before any. */
  url: string | null;
  /** The application the TV started from the AIT (`tv` mode); `null` when it runs none. */
  app: AitApplicationId | null;
  /** The TV's volume, 0–100: the user's (VOL+/VOL-), not the applications'. */
  volume: number;
}>;

/** A TV starts at full volume: the browser's own, as before the TV had a volume. */
export const DEFAULT_TV_VOLUME = 100;

/** How much VOL+/VOL- change the TV's volume. */
export const TV_VOLUME_STEP = 5;

/** VOL+ (`step` 1) / VOL- (`step` -1), within 0–100. */
export const stepVolume = (session: TvSession, step: 1 | -1): TvSession => ({
  ...session,
  volume: Math.max(0, Math.min(100, session.volume + step * TV_VOLUME_STEP)),
});

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
  serviceSelected: true,
  volume: DEFAULT_TV_VOLUME,
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
  const retuned = { ...session, channelId: channel.id, serviceSelected: true };
  if (session.mode === "app" || (session.app !== null && signalsApplication(channel.ait, session.app))) {
    return { session: retuned, navigateTo: null };
  }
  const selected = selectService(channel, tvPage);
  return { session: { ...retuned, ...selected }, navigateTo: selected.url };
};

/**
 * The session after the application exits (`destroyApplication()`), and the page the
 * tab must load. The TV stays on `channel`, re-parses its AIT and starts its
 * autostart application again, which may be the one that just exited; with none, it
 * shows the channel alone (TS 102 796 §6.2.2.3). The same in both modes: an
 * application opened on its own is also stopped, and its channel starts what it
 * signals. Without a channel (an empty lineup) the spec says nothing: the tab loads
 * nothing (`navigateTo` is `null`).
 */
export const exitApplication = (
  session: TvSession,
  channel: ChannelConfig | null,
  tvPage: TvPageUrl,
): Readonly<{ session: TvSession; navigateTo: string | null }> => {
  if (channel === null) return { session, navigateTo: null };
  const selected = selectService(channel, tvPage);
  return {
    session: { ...session, channelId: channel.id, serviceSelected: true, ...selected },
    navigateTo: selected.url,
  };
};

/**
 * The session after the application starts another (`createApplication()`), and the
 * page the tab must load; or why the TV cannot start it, which the application hears
 * as `ApplicationLoadError` (TS 102 796 §6.2.2.5.6).
 * - `dvb://current.ait/<org>.<app>`: that application of `channel`'s AIT, if it is
 *   signalled as AUTOSTART or PRESENT, at its signalled location with the URL's query
 *   and fragment (§9.2). It is broadcast-related, as the TV still selects the service.
 *   One of another service fails "as if the initial page could not be loaded" (§9.2).
 * - HTTP(S): a broadcast-independent application (§6.2.2.6.1). The TV selects no
 *   service any more: no broadcast, no current channel, until a channel is selected.
 * The same in both modes.
 */
export const launchApplication = (
  session: TvSession,
  channel: ChannelConfig | null,
  url: string,
): Readonly<{ _tag: "load"; session: TvSession; navigateTo: string } | { _tag: "fail"; reason: string }> => {
  const locator = parseDvbApplicationUrl(url);
  if (locator === null) {
    return /^https?:/i.test(url)
      ? { _tag: "load", session: { ...session, serviceSelected: false, app: null, url }, navigateTo: url }
      : { _tag: "fail", reason: `no application at ${url}` };
  }
  if (locator._tag === "otherService") return { _tag: "fail", reason: "an application of another service" };
  if (channel === null || !session.serviceSelected) return { _tag: "fail", reason: "no service is selected" };
  const signalled = signalledApplication(channel.ait, locator.id);
  if (signalled === null) {
    const { orgId, appId } = locator.id;
    return {
      _tag: "fail",
      reason: `${channel.name} signals no application ${orgId.toString(16)}.${appId.toString(16)}`,
    };
  }
  const location = applicationLocation(signalled.url, locator);
  return {
    _tag: "load",
    session: { ...session, app: applicationIdOf(signalled), url: location },
    navigateTo: location,
  };
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

/** The channel whose service the TV presents: none while it selects no service. */
export const presentedChannel = (state: ExtensionState, session: TvSession): ChannelConfig | null =>
  session.serviceSelected ? sessionChannel(state, session) : null;

/** What every page finds at `document_start`: the configuration, and the page each TV shows on which channel. */
export const toBootstrapData = (state: ExtensionState, sessions: TvSessions, assetUrl: AssetUrl): BootstrapData => ({
  config: toPageConfig(state, assetUrl),
  tunings: tuningsOf(state, sessions),
});

/** The page each TV shows, on which channel. */
const tuningsOf = (state: ExtensionState, sessions: TvSessions): BootstrapData["tunings"] =>
  Object.values(sessions).flatMap((session) => {
    const channel = sessionChannel(state, session);
    if (session.url === null || channel === null) return [];
    return [{ url: session.url, channelId: session.serviceSelected ? channel.id : null }];
  });

/**
 * The TV of a tab whose first HbbTV page is `url`: on the channel `initialChannel`
 * gives, with the data the page itself got at `document_start`, so the two agree
 * (the TV already showing that page, else the channel signalling it, else the first).
 */
export const newSession = (state: ExtensionState, sessions: TvSessions, url: string): TvSession => {
  const data = {
    config: { userAgent: state.runtime.userAgent, channels: state.runtime.channels },
    tunings: tuningsOf(state, sessions),
  };
  return {
    mode: "app",
    channelId: initialChannel(data, url)?.id ?? null,
    // The page another TV shows with no service selected starts with none too.
    serviceSelected: tunedChannelId(data.tunings, url) !== null,
    url,
    app: null,
    volume: DEFAULT_TV_VOLUME,
  };
};

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

export const toPageSession = (state: ExtensionState, session: TvSession, assetUrl: AssetUrl): PageSession => {
  const channel = presentedChannel(state, session);
  return { channel: channel && toPageChannel(channel, assetUrl), volume: session.volume };
};

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
