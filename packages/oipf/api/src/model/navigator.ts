/**
 * The TV's browser as the page's `navigator` describes it (ROADMAP 2.1): the properties
 * that name a browser, an engine or a machine, and would otherwise be those of the
 * browser the emulator runs in, against the TV's User-Agent.
 *
 * - `userAgent`, `appVersion`: the TV's User-Agent (`appVersion` is it without `Mozilla/`,
 *   as WebKit and Blink give it).
 * - `vendor`, `productSub`: fixed by the engine (WebKit's `NavigatorBase`, Blink's
 *   `NavigatorID`, Gecko's `Navigator`), which the device names or its User-Agent gives.
 * - `oscpu`, `buildID`: Gecko's alone; a TV of another engine has neither.
 * - `platform`, `hardwareConcurrency`: the TV's machine, which no User-Agent gives: the
 *   device says them, or they stay the browser's.
 * - `deviceMemory` (Blink, secure contexts) and `userAgentData` (the User-Agent Client
 *   Hints, Blink ≥ 89, secure contexts): never. Choice of the emulator, as for the HTTP
 *   headers: the TV has no client hints, as a browser from before them.
 *
 * `appCodeName` (`Mozilla`), `appName` (`Netscape`) and `product` (`Gecko`) are the same
 * in every engine: they stay. So does the `navigator` of workers, which the page cannot
 * reach before the worker's own scripts run.
 */

import * as t from "io-ts";

export const BROWSER_ENGINES = ["blink", "webkit", "gecko"] as const;

export type BrowserEngine = (typeof BROWSER_ENGINES)[number];

/** What the `navigator` says, by engine. */
export const ENGINE_NAVIGATOR: Readonly<Record<BrowserEngine, Readonly<{ vendor: string; productSub: string }>>> = {
  blink: { vendor: "Google Inc.", productSub: "20030107" },
  webkit: { vendor: "Apple Computer, Inc.", productSub: "20030107" },
  gecko: { vendor: "", productSub: "20100101" },
};

/** What the device says of its browser beyond its User-Agent. Each one left out stays the browser's. */
export const DeviceNavigatorCodec = t.readonly(
  t.partial({
    /**
     * Its engine, when its User-Agent does not give it (`engineOfUserAgent`): Tizen 4 and
     * later run Blink with a User-Agent without `Chrome/`.
     */
    engine: t.keyof({ blink: null, webkit: null, gecko: null }),
    /** `navigator.platform`, e.g. `Linux armv7l`: Linux and the machine, as `uname` gives it. */
    platform: t.string,
    /** `navigator.hardwareConcurrency`; `null`: the engine has none (Chromium < 37, old WebKit). */
    hardwareConcurrency: t.union([t.number, t.null]),
  }),
);

export type DeviceNavigator = t.TypeOf<typeof DeviceNavigatorCodec>;

/**
 * The engine a User-Agent names, if it names one. Blink keeps `AppleWebKit/537.36` and
 * WebKit's `like Gecko`: `Chrome/` goes first, and Gecko is its `Gecko/<version>` token.
 * `AppleWebKit` in any case: Tizen 2 writes `AppleWebkit`.
 */
export const engineOfUserAgent = (userAgent: string): BrowserEngine | undefined => {
  if (/\b(?:Chrome|Chromium|HeadlessChrome)\/\d/.test(userAgent)) return "blink";
  if (/\bGecko\/\d/.test(userAgent)) return "gecko";
  if (/\bAppleWebKit\/\d/i.test(userAgent)) return "webkit";
  return undefined;
};

/** The properties of the `navigator` the emulator sets. */
export const NAVIGATOR_PROPERTIES = [
  "userAgent",
  "appVersion",
  "vendor",
  "productSub",
  "platform",
  "oscpu",
  "buildID",
  "hardwareConcurrency",
  "deviceMemory",
  "userAgentData",
] as const;

export type NavigatorProperty = (typeof NAVIGATOR_PROPERTIES)[number];

/**
 * The TV's `navigator`: a value for each property it sets, `null` for each it does not
 * have at all (`"oscpu" in navigator` is false). A property left out is the browser's.
 */
export type NavigatorProperties = Readonly<Partial<Record<NavigatorProperty, string | number | null>>>;

/** The `navigator` of a TV with this User-Agent, and what its device says beyond it. */
export const navigatorProperties = (userAgent: string, device: DeviceNavigator = {}): NavigatorProperties => {
  const engine = device.engine ?? engineOfUserAgent(userAgent);
  return {
    userAgent,
    appVersion: userAgent.replace("Mozilla/", ""),
    ...(engine && ENGINE_NAVIGATOR[engine]),
    ...(engine && engine !== "gecko" && { oscpu: null, buildID: null }),
    ...(device.platform !== undefined && {
      platform: device.platform,
      ...(engine === "gecko" && { oscpu: device.platform }),
    }),
    ...(device.hardwareConcurrency !== undefined && { hardwareConcurrency: device.hardwareConcurrency }),
    deviceMemory: null,
    userAgentData: null,
  };
};
