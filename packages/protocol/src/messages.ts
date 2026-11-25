/**
 * Messages between the page runtime and its host.
 *
 * Three kinds of data flow, kept apart on purpose (ROADMAP D5):
 * - configuration (channels, user agent, …): host → page, at start and on change;
 * - OIPF object state: owned by the page. The host never pushes a full snapshot,
 *   which would wipe what the application did (e.g. reset its keyset to 0);
 * - commands (remote-control keys): host → page.
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
}>;

export type PageMessage = Readonly<{ _tag: "Page/Ready"; url: string }>;

export type HostMessage =
  /** The bridge started: the page announces itself again (the two may start in any order). */
  | Readonly<{ _tag: "Host/Hello" }>
  | Readonly<{ _tag: "Host/Config"; config: PageConfig }>
  | Readonly<{ _tag: "Host/DispatchKey"; keyCode: number }>
  /** An explicit edit (e.g. from the settings UI): only the fields that changed. */
  | Readonly<{ _tag: "Host/ApplyState"; patch: Partial<HbbTVState> }>
  /** The tab's TV session: sent after `Host/Config`, and whenever it changes. */
  | Readonly<{ _tag: "Host/Session"; session: PageSession }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const isPageConfig = (value: unknown): value is PageConfig =>
  isRecord(value) && typeof value.userAgent === "string" && Array.isArray(value.channels);

const isChannel = (value: unknown): value is ChannelConfig => isRecord(value) && typeof value.id === "string";

export const isPageSession = (value: unknown): value is PageSession =>
  isRecord(value) && (value.channel === null || isChannel(value.channel));

export const isPageMessage = (value: unknown): value is PageMessage =>
  isRecord(value) && value._tag === "Page/Ready" && typeof value.url === "string";

export const isHostMessage = (value: unknown): value is HostMessage => {
  if (!isRecord(value)) return false;
  switch (value._tag) {
    case "Host/Hello":
      return true;
    case "Host/Config":
      return isPageConfig(value.config);
    case "Host/DispatchKey":
      return typeof value.keyCode === "number" && Number.isInteger(value.keyCode);
    case "Host/ApplyState":
      return isRecord(value.patch);
    case "Host/Session":
      return isPageSession(value.session);
    default:
      return false;
  }
};
