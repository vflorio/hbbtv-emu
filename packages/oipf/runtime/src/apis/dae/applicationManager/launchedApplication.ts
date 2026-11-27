/**
 * The Application object `createApplication()` returns: the new application, which
 * runs in the page the TV loads next, not in this one.
 *
 * Until then its methods do nothing here. If the TV cannot start it, the page's
 * application managers fire `ApplicationLoadError` with it, and from then on "all
 * properties … SHALL have the value undefined and calling any methods on that object
 * SHALL fail" (OIPF DAE §7.2.1.3).
 */

import type { OIPF } from "@hbb-emu/oipf-api";

const failedToLoad = (): never => {
  throw new Error("The application could not be loaded");
};

export class LaunchedApplication implements OIPF.DAE.ApplicationManager.Application {
  #failed = false;

  /** Its data is the new page's; here there is none. */
  get privateData(): undefined {
    return undefined;
  }

  /** The TV could not start it. */
  fail = (): void => {
    this.#failed = true;
  };

  #call = (): void => {
    if (this.#failed) failedToLoad();
  };

  getKeyset = (): null => {
    this.#call();
    return null;
  };

  show = (): void => this.#call();

  hide = (): void => this.#call();

  createApplication = (): null => {
    this.#call();
    return null;
  };

  destroyApplication = (): void => this.#call();
}

/**
 * The URL the TV starts an application at: a `dvb:` URL as it is, any other resolved
 * against the document (`baseURI`); `null` when it is not an HTTP(S) or `dvb:` URL,
 * which no application can be created from (OIPF DAE §7.2.2.2: `createApplication()`
 * then returns `null`).
 */
export const applicationUrl = (uri: unknown, baseURI: string): string | null => {
  if (typeof uri !== "string") return null;
  const trimmed = uri.trim();
  if (/^dvb:/i.test(trimmed)) return trimmed;
  try {
    const resolved = new URL(trimmed, baseURI);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null;
  } catch {
    return null;
  }
};
