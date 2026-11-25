/**
 * Messages between the page runtime and its host.
 *
 * Three kinds of data flow, kept apart on purpose (ROADMAP D5):
 * - configuration (channels, user agent, …): host → page, at start and on change;
 * - OIPF object state: owned by the page. The host never pushes a full snapshot,
 *   which would wipe what the application did (e.g. reset its keyset to 0);
 * - commands (remote-control keys): host → page.
 */

import type { ChannelConfig } from "@hbb-emu/extension-common";

/** What the page runtime needs from the host's configuration. */
export type PageConfig = Readonly<{
  userAgent: string;
  channels: ReadonlyArray<ChannelConfig>;
}>;

export type PageMessage = Readonly<{ _tag: "Page/Ready"; url: string }>;

export type HostMessage =
  /** The bridge started: the page announces itself again (the two may start in any order). */
  | Readonly<{ _tag: "Host/Hello" }>
  | Readonly<{ _tag: "Host/Config"; config: PageConfig }>
  | Readonly<{ _tag: "Host/DispatchKey"; keyCode: number }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const isPageMessage = (value: unknown): value is PageMessage =>
  isRecord(value) && value._tag === "Page/Ready" && typeof value.url === "string";

export const isHostMessage = (value: unknown): value is HostMessage => {
  if (!isRecord(value)) return false;
  switch (value._tag) {
    case "Host/Hello":
      return true;
    case "Host/Config":
      return (
        isRecord(value.config) && typeof value.config.userAgent === "string" && Array.isArray(value.config.channels)
      );
    case "Host/DispatchKey":
      return typeof value.keyCode === "number" && Number.isInteger(value.keyCode);
    default:
      return false;
  }
};
