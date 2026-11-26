/**
 * Messages between the page runtime and its host.
 *
 * Three kinds of data flow, kept apart on purpose (ROADMAP D5):
 * - configuration (channels, user agent, …): host → page, at start and on change;
 * - OIPF object state: owned by the page. The host never pushes a full snapshot,
 *   which would wipe what the application did (e.g. reset its keyset to 0);
 * - commands (remote-control keys): host → page; the TV's own keys pressed on the
 *   keyboard: page → host.
 * - requests: the application asks the TV to change channel (`setChannel()`), and
 *   the host answers with the new session or an error, or loads another page.
 *
 * Plus the TV session of the tab (the channel it is tuned to, …): owned by the host,
 * it outlives the page, which gets it again after every navigation.
 */

import type { ChannelConfig } from "@hbb-emu/extension-common";
import type { HbbTVState } from "@hbb-emu/oipf-api";

/** What the page runtime needs from the host's configuration. */
export type PageConfig = Readonly<{
  userAgent: string;
  channels: ReadonlyArray<ChannelConfig>;
}>;

/** The part of the tab's TV session the page runtime needs. */
export type PageSession = Readonly<{
  /** The channel the TV is tuned to; `null` if the lineup is empty. */
  channel: ChannelConfig | null;
  /**
   * The TV's volume, 0–100: the user's (VOL+/VOL-). The application cannot see it;
   * its objects' audio plays in series with it (TS 102 796 §10.2.12).
   */
  volume: number;
}>;

export type PageMessage =
  | Readonly<{ _tag: "Page/Ready"; url: string }>
  /** The application asks to change to another channel of the lineup (`setChannel()`). */
  | Readonly<{ _tag: "Page/SetChannel"; channelId: string }>
  /**
   * A key the TV keeps for itself (P+/P-, volume; TS 102 796 §10.2.2.1), pressed on
   * the keyboard in this page: the TV of this tab acts on it.
   */
  | Readonly<{ _tag: "Page/TvKey"; keyCode: number }>;

export type HostMessage =
  /** The bridge started: the page announces itself again (the two may start in any order). */
  | Readonly<{ _tag: "Host/Hello" }>
  | Readonly<{ _tag: "Host/Config"; config: PageConfig }>
  | Readonly<{ _tag: "Host/DispatchKey"; keyCode: number }>
  /** An explicit edit (e.g. from the settings UI): only the fields that changed. */
  | Readonly<{ _tag: "Host/ApplyState"; patch: Partial<HbbTVState> }>
  /** The tab's TV session: sent after `Host/Config`, and whenever it changes. */
  | Readonly<{ _tag: "Host/Session"; session: PageSession }>
  /**
   * The TV did not change to the channel the application asked for. `error` is the
   * OIPF channel change error code (e.g. 5, unknown channel).
   */
  | Readonly<{ _tag: "Host/ChannelChangeError"; channelId: string; error: number }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const isPageConfig = (value: unknown): value is PageConfig =>
  isRecord(value) && typeof value.userAgent === "string" && Array.isArray(value.channels);

const isKeyCode = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

const isChannel = (value: unknown): value is ChannelConfig => isRecord(value) && typeof value.id === "string";

export const isPageSession = (value: unknown): value is PageSession =>
  isRecord(value) && (value.channel === null || isChannel(value.channel)) && typeof value.volume === "number";

export const isPageMessage = (value: unknown): value is PageMessage => {
  if (!isRecord(value)) return false;
  switch (value._tag) {
    case "Page/Ready":
      return typeof value.url === "string";
    case "Page/SetChannel":
      return typeof value.channelId === "string";
    case "Page/TvKey":
      return isKeyCode(value.keyCode);
    default:
      return false;
  }
};

export const isHostMessage = (value: unknown): value is HostMessage => {
  if (!isRecord(value)) return false;
  switch (value._tag) {
    case "Host/Hello":
      return true;
    case "Host/Config":
      return isPageConfig(value.config);
    case "Host/DispatchKey":
      return isKeyCode(value.keyCode);
    case "Host/ApplyState":
      return isRecord(value.patch);
    case "Host/Session":
      return isPageSession(value.session);
    case "Host/ChannelChangeError":
      return typeof value.channelId === "string" && typeof value.error === "number" && Number.isInteger(value.error);
    default:
      return false;
  }
};
