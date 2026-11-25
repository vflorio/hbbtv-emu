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
 */

import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import { isPageConfig, type PageConfig } from "./messages";

/** Where the configuration is left in the page (a symbol: invisible to `Object.keys(window)`). */
export const CONFIG_KEY_NAME = "hbb-emu.config";

const CONFIG_KEY = Symbol.for(CONFIG_KEY_NAME);

/** The code a host injects into the page's own world at `document_start`. */
export const configBootstrapScript = (config: PageConfig): string =>
  `globalThis[Symbol.for(${JSON.stringify(CONFIG_KEY_NAME)})] = ${JSON.stringify(config)};`;

type Scope = Record<symbol, unknown>;

/**
 * Page side. Returns the configuration if the bootstrap script already ran;
 * otherwise `none`, and `onLateConfig` is called when (if) it runs.
 */
export const receiveBootstrapConfig =
  (scope: object, onLateConfig: (config: PageConfig) => void): IO.IO<O.Option<PageConfig>> =>
  () => {
    const present = (scope as Scope)[CONFIG_KEY];
    if (isPageConfig(present)) return O.some(present);

    let value: unknown;
    Object.defineProperty(scope, CONFIG_KEY, {
      configurable: true,
      enumerable: false,
      get: () => value,
      set: (next: unknown) => {
        value = next;
        if (isPageConfig(next)) onLateConfig(next);
      },
    });
    return O.none;
  };
