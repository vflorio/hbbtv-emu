/**
 * The application's channel changes, asked of the host (the tab's TV session
 * decides, ROADMAP D5). The host answers with the tab's new session (the TV is on
 * the channel), or with an error. When the new channel shows another page, the
 * session comes first, as a TV tunes before the new service's AIT ends the
 * application.
 *
 * A request nobody answers (the bridge was not listening yet, the background did
 * not reply) fails after `timeoutMs`, so the application always hears back.
 */

import { createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf-api";
import type { ChannelChangeRequest } from "@hbb-emu/oipf-runtime";
import type { PageMessage, PageSession } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import * as IO from "fp-ts/IO";

const logger = createLogger("PageRuntime:ChannelChange");

type Result = E.Either<OIPF.DAE.Broadcast.ChannelChangeErrorCode, void>;

/** Well above what the background takes, even waking up an MV3 service worker. */
export const CHANNEL_CHANGE_TIMEOUT_MS = 10_000;

export type HostChannelChanges = Readonly<{
  request: ChannelChangeRequest;
  /** The tab's session changed: the requests for its channel succeeded. */
  settle: (session: PageSession) => IO.IO<void>;
  /** The host refused the change to that channel. */
  fail: (channelId: string, error: number) => IO.IO<void>;
}>;

export const createHostChannelChanges = (
  send: (message: PageMessage) => IO.IO<void>,
  timeoutMs: number = CHANNEL_CHANGE_TIMEOUT_MS,
): HostChannelChanges => {
  const pending = new Map<string, ReadonlyArray<(result: Result) => void>>();

  const resolve =
    (channelId: string, result: Result): IO.IO<void> =>
    () => {
      const waiting = pending.get(channelId) ?? [];
      pending.delete(channelId);
      for (const settle of waiting) settle(result);
    };

  const forget = (channelId: string, waiter: (result: Result) => void): void => {
    const others = (pending.get(channelId) ?? []).filter((other) => other !== waiter);
    if (others.length === 0) pending.delete(channelId);
    else pending.set(channelId, others);
  };

  return {
    request: (channel) => () =>
      new Promise<Result>((settle) => {
        const timer = setTimeout(() => {
          forget(channel.id, waiter);
          logger.warn(`The host did not answer the change to channel ${channel.id} within ${timeoutMs} ms`)();
          settle(E.left(OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNIDENTIFIED_ERROR));
        }, timeoutMs);
        const waiter = (result: Result) => {
          clearTimeout(timer);
          settle(result);
        };
        pending.set(channel.id, [...(pending.get(channel.id) ?? []), waiter]);
        send({ _tag: "Page/SetChannel", channelId: channel.id })();
      }),
    settle: (session) => (session.channel ? resolve(session.channel.id, E.right(undefined)) : IO.of(undefined)),
    fail: (channelId, error) => resolve(channelId, E.left(error as OIPF.DAE.Broadcast.ChannelChangeErrorCode)),
  };
};
