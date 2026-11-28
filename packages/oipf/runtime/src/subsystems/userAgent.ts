import { createLogger } from "@hbb-emu/core";
import {
  DEFAULT_HBBTV_VERSION,
  type DeviceNavigator,
  emulatorUserAgent,
  NAVIGATOR_PROPERTIES,
  type NavigatorProperties,
  navigatorProperties,
} from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import type { RuntimeState } from "../runtime";

const logger = createLogger("UserAgent");

// Dependencies

/** Provides access to current user agent configuration */
type UserAgentConfig = Readonly<{
  getUserAgent: IO.IO<string | undefined>;
  getHbbTVVersion: IO.IO<string | undefined>;
  defaultHbbTVVersion: string;
  /** What the device says of its browser beyond its User-Agent (`DeviceProfile.navigator`). */
  getNavigator: IO.IO<DeviceNavigator | undefined>;
}>;

/** Provides DOM manipulation for context override */
type ContextOverride = Readonly<{
  /**
   * Makes the page's `navigator` the TV's (`navigatorProperties`): every property it sets,
   * every one it takes away, and the browser's own again for those it no longer names.
   */
  applyNavigator: (properties: NavigatorProperties) => IO.IO<void>;
}>;

export type UserAgentEnv = UserAgentConfig & ContextOverride;

// Default implementations

/**
 * What applies the TV's properties to a navigator, again and again (each configuration
 * from the host applies them): a value is an accessor of the navigator itself, which
 * shadows the browser's on its prototype; a property the TV does not have goes off the
 * navigator and its prototypes, so `in` does not find it. What it takes off the browser,
 * it keeps, to give back when a later configuration leaves the property to the browser.
 */
export const navigatorOverride = (target: object): ContextOverride["applyNavigator"] => {
  const record = target as Record<string, unknown>;
  /** The properties set on the navigator itself. */
  const set = new Set<string>();
  /** The browser's own, taken off: where each was, and what it was. */
  const taken = new Map<string, Array<readonly [object, PropertyDescriptor]>>();

  const takeOff = (name: string) => {
    for (let object: object | null = target; object !== null; object = Object.getPrototypeOf(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, name);
      if (!descriptor?.configurable) continue;
      taken.set(name, [...(taken.get(name) ?? []), [object, descriptor]]);
      delete (object as Record<string, unknown>)[name];
    }
  };

  const giveBack = (name: string) => {
    for (const [object, descriptor] of taken.get(name) ?? []) Object.defineProperty(object, name, descriptor);
    taken.delete(name);
  };

  return (properties) => () => {
    for (const name of NAVIGATOR_PROPERTIES) {
      if (set.delete(name)) delete record[name];
      giveBack(name);
      const value = properties[name];
      if (value === undefined) continue;
      if (value === null) {
        takeOff(name);
        continue;
      }
      // An engine with the property on the navigator itself: off first, to give it back.
      if (Object.getOwnPropertyDescriptor(target, name)) takeOff(name);
      try {
        Object.defineProperty(target, name, { get: () => value, configurable: true, enumerable: true });
        set.add(name);
      } catch (error) {
        logger.warn(`navigator.${name} stays the browser's:`, error)();
      }
    }
  };
};

let pageNavigator: ContextOverride["applyNavigator"] | undefined;

export const navigatorContextOverride: ContextOverride = {
  applyNavigator: (properties) => () => {
    pageNavigator ??= navigatorOverride(navigator);
    pageNavigator(properties)();
  },
};

// Operations

export const resolveUserAgent: RIO.ReaderIO<UserAgentConfig, string> = (env) =>
  pipe(
    env.getUserAgent,
    IO.flatMap((userAgent) =>
      userAgent
        ? IO.of(userAgent)
        : pipe(
            env.getHbbTVVersion,
            IO.map((version) => emulatorUserAgent(version ?? env.defaultHbbTVVersion)),
          ),
    ),
  );

/** The page's `navigator` is the TV's: its User-Agent, its engine, its machine (ROADMAP 2.1). */
export const initializeUserAgent: RIO.ReaderIO<UserAgentEnv, void> = (env) =>
  pipe(
    IO.Do,
    IO.bind("userAgent", () => resolveUserAgent(env)),
    IO.bind("device", () => env.getNavigator),
    IO.map(({ userAgent, device }) => navigatorProperties(userAgent, device)),
    IO.tap((properties) => logger.info("Overriding navigator:", properties)),
    IO.flatMap(env.applyNavigator),
  );

export const createUserAgentEnv = (extensionState: RuntimeState): UserAgentEnv => ({
  getUserAgent: () => extensionState.userAgent,
  getHbbTVVersion: () => extensionState.device?.terminal.hbbtvVersion,
  defaultHbbTVVersion: DEFAULT_HBBTV_VERSION,
  getNavigator: () => extensionState.device?.navigator,
  ...navigatorContextOverride,
});
