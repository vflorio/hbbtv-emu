/**
 * Stream event descriptions (XML over HTTP(S), TS 102 796 §8.2.1.1), fetched by the host:
 * a TV fetches them natively, without CORS, and so does the extension's background, with
 * its host permissions. The page could not read a description served from another origin
 * without CORS headers, which a TV reads.
 *
 * Requests for the same URL share the answer. A request nobody answers (the bridge was not
 * listening yet, the background did not reply) fails after `timeoutMs`: the application
 * then gets an error event, as for a file that cannot be fetched.
 */

import { createLogger } from "@hbb-emu/core";
import type { FetchStreamEventDescription, StreamEventDescriptionFile } from "@hbb-emu/oipf-runtime";
import type { PageMessage, StreamEventDescriptionResult } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import type * as IO from "fp-ts/IO";

const logger = createLogger("PageRuntime:StreamEventDescriptions");

type Result = E.Either<string, StreamEventDescriptionFile>;

/** Well above what the background takes, even waking up an MV3 service worker and fetching. */
export const STREAM_EVENT_DESCRIPTION_TIMEOUT_MS = 10_000;

export type HostStreamEventDescriptions = Readonly<{
  fetch: FetchStreamEventDescription;
  /** The host's answer for `url`. */
  settle: (url: string, result: StreamEventDescriptionResult) => IO.IO<void>;
}>;

export const createHostStreamEventDescriptions = (
  send: (message: PageMessage) => IO.IO<void>,
  timeoutMs: number = STREAM_EVENT_DESCRIPTION_TIMEOUT_MS,
): HostStreamEventDescriptions => {
  const pending = new Map<string, ReadonlyArray<(result: Result) => void>>();

  const forget = (url: string, waiter: (result: Result) => void): void => {
    const others = (pending.get(url) ?? []).filter((other) => other !== waiter);
    if (others.length === 0) pending.delete(url);
    else pending.set(url, others);
  };

  return {
    fetch: (url) => () =>
      new Promise<Result>((settle) => {
        const timer = setTimeout(() => {
          forget(url, waiter);
          logger.warn(`The host did not fetch ${url} within ${timeoutMs} ms`)();
          settle(E.left(`the host did not answer within ${timeoutMs} ms`));
        }, timeoutMs);
        const waiter = (result: Result) => {
          clearTimeout(timer);
          settle(result);
        };
        const asked = pending.has(url);
        pending.set(url, [...(pending.get(url) ?? []), waiter]);
        if (!asked) send({ _tag: "Page/FetchStreamEventDescription", url })();
      }),
    settle: (url, result) => () => {
      const waiting = pending.get(url) ?? [];
      pending.delete(url);
      const settled: Result = result.ok
        ? E.right({ contentType: result.contentType, body: result.body })
        : E.left(result.reason);
      for (const waiter of waiting) waiter(settled);
    },
  };
};
