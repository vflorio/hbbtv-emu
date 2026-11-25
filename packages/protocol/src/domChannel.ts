/**
 * DOM transport between the page runtime (MAIN world) and the bridge (ISOLATED world).
 *
 * Both worlds share the DOM, so a `CustomEvent` dispatched on the document reaches the
 * other side. Payloads travel as JSON strings: objects do not cross JS worlds (Chrome
 * nulls them, Firefox needs cloneInto), strings do. Unlike `window.postMessage`, the
 * application's own `message` listeners never see this traffic.
 */

import type * as IO from "fp-ts/IO";
import { type HostMessage, isHostMessage, isPageMessage, type PageMessage } from "./messages";

export const TO_HOST_EVENT = "hbb-emu:to-host";
export const TO_PAGE_EVENT = "hbb-emu:to-page";

export type DomChannel<Out, In> = Readonly<{
  send: (message: Out) => IO.IO<void>;
  /** Invalid or foreign payloads are dropped. Returns the unsubscribe effect. */
  subscribe: (handler: (message: In) => IO.IO<void>) => IO.IO<IO.IO<void>>;
}>;

const parse = (detail: unknown): unknown => {
  if (typeof detail !== "string") return undefined;
  try {
    return JSON.parse(detail);
  } catch {
    return undefined;
  }
};

const createDomChannel = <Out, In>(
  target: EventTarget,
  outEvent: string,
  inEvent: string,
  isIn: (value: unknown) => value is In,
): DomChannel<Out, In> => ({
  send: (message) => () => {
    target.dispatchEvent(new CustomEvent(outEvent, { detail: JSON.stringify(message) }));
  },
  subscribe: (handler) => () => {
    const listener = (event: Event) => {
      const message = parse((event as CustomEvent).detail);
      if (isIn(message)) handler(message)();
    };
    target.addEventListener(inEvent, listener);
    return () => target.removeEventListener(inEvent, listener);
  },
});

/** Used by the page runtime. */
export const createPageChannel = (target: EventTarget): DomChannel<PageMessage, HostMessage> =>
  createDomChannel(target, TO_HOST_EVENT, TO_PAGE_EVENT, isHostMessage);

/** Used by the bridge. */
export const createBridgeChannel = (target: EventTarget): DomChannel<HostMessage, PageMessage> =>
  createDomChannel(target, TO_PAGE_EVENT, TO_HOST_EVENT, isPageMessage);
