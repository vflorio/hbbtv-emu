/**
 * Synchronous configuration at `document_start`.
 *
 * Messages reach the page only after a round trip to the host, i.e. after the
 * application's first scripts have run (and read the user agent, the channel…).
 * Hosts that can inject code into the page (MV3 `userScripts`, Firefox
 * `contentScripts.register`, a browser preload hook) inject `configBootstrapScript`
 * instead: it runs before any application script, so the configuration is there
 * in time.
 *
 * The page runtime and the bootstrap script are two scripts injected at the same
 * moment, in an order the host does not guarantee (Chromium runs content scripts
 * first): the runtime takes the configuration if it is already there, and is
 * notified otherwise.
 *
 * The bootstrap is one script for every tab: the hosts cannot inject per tab. What
 * is per tab (the channel each TV is on) is told by URL instead: the page whose URL
 * a TV is showing is on that TV's channel (`Tuning`).
 */

import { applicationOfPage, channelSignalling } from "@hbb-emu/oipf-api";
import type { ChannelConfig } from "@hbb-emu/state";
import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import { isPageConfig, type PageConfig } from "./messages";

/**
 * The TV of a tab showing `url` is on `channelId`; `null` when it selects no service,
 * as while a broadcast-independent application runs (TS 102 796 §6.2.2.6.1).
 * `activated`: whether the application it runs is activated (TS 102 796 §10.2.2.1).
 */
export type Tuning = Readonly<{ url: string; channelId: string | null; activated: boolean }>;

/** What the bootstrap gives the page: the configuration, and what each TV is tuned to. */
export type BootstrapData = Readonly<{
  config: PageConfig;
  tunings: ReadonlyArray<Tuning>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isTuning = (value: unknown): value is Tuning =>
  isRecord(value) &&
  typeof value.url === "string" &&
  (value.channelId === null || typeof value.channelId === "string") &&
  typeof value.activated === "boolean";

export const isBootstrapData = (value: unknown): value is BootstrapData =>
  isRecord(value) && isPageConfig(value.config) && Array.isArray(value.tunings) && value.tunings.every(isTuning);

// ─────────────────────────────────────────────────────────────────────────────
// The channel a page starts on
// ─────────────────────────────────────────────────────────────────────────────

/** A URL without its fragment: a page and its anchors are the same document. */
const documentUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return parsed.href.slice(0, parsed.href.length - parsed.hash.length);
  } catch {
    return null;
  }
};

/**
 * What the TVs showing this page agree on; `undefined` if no TV shows it, or if they
 * differ (the page cannot tell which tab it is in).
 */
const tunedValue = <T extends Pick<Tuning, "url">, A>(
  tunings: ReadonlyArray<T>,
  url: string,
  read: (tuning: T) => A,
): A | undefined => {
  const page = documentUrl(url);
  if (page === null) return undefined;
  const values = new Set(tunings.filter((tuning) => documentUrl(tuning.url) === page).map(read));
  return values.size === 1 ? [...values][0] : undefined;
};

/**
 * The channel the TVs showing this page are on (`null`: they select no service);
 * `undefined` if no TV shows it, or if TVs on different channels do.
 */
export const tunedChannelId = (
  tunings: ReadonlyArray<Pick<Tuning, "url" | "channelId">>,
  url: string,
): string | null | undefined => tunedValue(tunings, url, (tuning) => tuning.channelId);

/**
 * The channel a page starts on, before the host says which one its tab is on:
 * 1. the channel of the TV showing it (a reload, a navigation the host made), none
 *    if that TV selects no service (a broadcast-independent application);
 * 2. the channel whose AIT signals its application;
 * 3. the first of the lineup.
 * The background opens a tab's TV session with the same rule and the same data, so
 * the two agree and the session does not retune the page.
 */
export const initialChannel = ({ config, tunings }: BootstrapData, url: string): ChannelConfig | null => {
  const tunedId = tunedChannelId(tunings, url);
  if (tunedId === null) return null;
  const tuned = tunedId === undefined ? undefined : config.channels.find((channel) => channel.id === tunedId);
  return tuned ?? channelSignalling(config.channels, url) ?? config.channels[0] ?? null;
};

/**
 * Whether a page starts with its application activated (TS 102 796 §10.2.2.1: the
 * digits and the VCR keys are only available to an activated application), before
 * the host says so for its tab:
 * 1. what the TV showing it says (a reload, a navigation the host made);
 * 2. otherwise, not activated if the channel it starts on (`initialChannel`) signals
 *    its application as AUTOSTART: the TV started it, and it is activated by its first
 *    key event. Any other application was launched (PRESENT, broadcast-independent),
 *    hence activated.
 * The background opens a tab's TV session with the same rule and the same data.
 */
export const initialActivation = (data: BootstrapData, url: string): boolean => {
  const tuned = tunedValue(data.tunings, url, (tuning) => tuning.activated);
  if (tuned !== undefined) return tuned;
  const application = applicationOfPage(initialChannel(data, url)?.ait, url);
  return application?.controlCode !== "AUTOSTART";
};

// ─────────────────────────────────────────────────────────────────────────────
// Injection
// ─────────────────────────────────────────────────────────────────────────────

/** Where the data is left in the page (a symbol: invisible to `Object.keys(window)`). */
export const CONFIG_KEY_NAME = "hbb-emu.config";

const CONFIG_KEY = Symbol.for(CONFIG_KEY_NAME);

/**
 * The code a host injects into the page's own world at `document_start`. Only HbbTV
 * documents get the data (some hosts run it in every page): the same check as
 * `isHbbTVDocument`, repeated because the code must be self-contained.
 */
export const configBootstrapScript = (data: BootstrapData): string =>
  `(function () {
  var type = String(document.contentType || "").toLowerCase();
  if (type !== "application/xhtml+xml" && type.indexOf("hbbtv") === -1) return;
  globalThis[Symbol.for(${JSON.stringify(CONFIG_KEY_NAME)})] = ${JSON.stringify(data)};
})();`;

type Scope = Record<symbol, unknown>;

/**
 * Page side. Returns the data if the bootstrap script already ran; otherwise
 * `none`, and `onLate` is called when (if) it runs.
 */
export const receiveBootstrap =
  (scope: object, onLate: (data: BootstrapData) => void): IO.IO<O.Option<BootstrapData>> =>
  () => {
    const present = (scope as Scope)[CONFIG_KEY];
    if (isBootstrapData(present)) return O.some(present);

    let value: unknown;
    Object.defineProperty(scope, CONFIG_KEY, {
      configurable: true,
      enumerable: false,
      get: () => value,
      set: (next: unknown) => {
        value = next;
        if (isBootstrapData(next)) onLate(next);
      },
    });
    return O.none;
  };
