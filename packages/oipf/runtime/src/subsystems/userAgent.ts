import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { buildDefaultUserAgent, DEFAULT_HBBTV_VERSION } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";

const logger = createLogger("UserAgent");

// Dependencies

/** Provides access to current user agent configuration */
type UserAgentConfig = Readonly<{
  getUserAgent: IO.IO<string | undefined>;
  getHbbTVVersion: IO.IO<string | undefined>;
  defaultHbbTVVersion: string;
}>;

/** Provides DOM manipulation for context override */
type ContextOverride = Readonly<{
  setUserAgent: (userAgent: string) => IO.IO<void>;
  setAppVersion: (appVersion: string) => IO.IO<void>;
  /**
   * Takes the browser's User-Agent Client Hints away (`navigator.userAgentData`, in secure
   * contexts): they name the real browser, against the TV's user agent. Choice of the
   * emulator, as for the HTTP headers (the host's `UserAgentAdapter`): the TV has none, as
   * a browser from before them (Chromium < 89, WebKit, Gecko).
   */
  hideUserAgentData: IO.IO<void>;
}>;

export type UserAgentEnv = UserAgentConfig & ContextOverride;

// Default implementations

export const navigatorContextOverride: ContextOverride = {
  setUserAgent: (userAgent) => () => {
    Object.defineProperty(navigator, "userAgent", {
      get: () => userAgent,
      configurable: true,
    });
  },
  setAppVersion: (appVersion) => () => {
    Object.defineProperty(navigator, "appVersion", {
      get: () => appVersion,
      configurable: true,
    });
  },
  hideUserAgentData: () => hideUserAgentData(navigator),
};

/** Off the navigator and its prototypes: `"userAgentData" in navigator` is false, as on a browser without it. */
export const hideUserAgentData = (target: object): void => {
  for (let object: object | null = target; object !== null; object = Object.getPrototypeOf(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, "userAgentData");
    if (descriptor?.configurable) delete (object as { userAgentData?: unknown }).userAgentData;
  }
};

// Operations

export const overrideUserAgent =
  (userAgent: string): RIO.ReaderIO<ContextOverride, void> =>
  (env) =>
    pipe(
      logger.info("Overriding navigator.userAgent:", userAgent),
      IO.tap(() => env.setUserAgent(userAgent)),
      IO.tap(() => env.setAppVersion(userAgent.replace("Mozilla/", ""))),
      IO.tap(() => env.hideUserAgentData),
      IO.tap(() => logger.info("navigator.userAgent override complete")),
    );

export const resolveUserAgent: RIO.ReaderIO<UserAgentConfig, string> = (env) =>
  pipe(
    env.getUserAgent,
    IO.flatMap((userAgent) =>
      userAgent
        ? IO.of(userAgent)
        : pipe(
            env.getHbbTVVersion,
            IO.map((version) => buildDefaultUserAgent({ hbbtvVersion: version ?? env.defaultHbbTVVersion })),
          ),
    ),
  );

export const initializeUserAgent: RIO.ReaderIO<UserAgentEnv, void> = (env) =>
  pipe(
    env,
    resolveUserAgent,
    IO.flatMap((userAgent) => overrideUserAgent(userAgent)(env)),
  );

export const createUserAgentEnv = (extensionState: ExtensionState): UserAgentEnv => ({
  getUserAgent: () => extensionState.userAgent,
  getHbbTVVersion: () => extensionState.hbbtv.oipfCapabilities?.hbbtvVersion,
  defaultHbbTVVersion: DEFAULT_HBBTV_VERSION,
  ...navigatorContextOverride,
});
