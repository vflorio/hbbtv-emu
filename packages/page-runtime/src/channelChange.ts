/**
 * The application's channel changes, asked of the host (the tab's TV session
 * decides, ROADMAP D5). The host answers with the tab's new session (the TV is on
 * the channel), with an error, or by loading another page: the change ended the
 * application, and its request never settles.
 */

import type { OIPF } from "@hbb-emu/oipf-api";
import type { ChannelChangeRequest } from "@hbb-emu/oipf-runtime";
import type { PageMessage, PageSession } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import * as IO from "fp-ts/IO";

type Result = E.Either<OIPF.DAE.Broadcast.ChannelChangeErrorCode, void>;

export type HostChannelChanges = Readonly<{
  request: ChannelChangeRequest;
  /** The tab's session changed: the requests for its channel succeeded. */
  settle: (session: PageSession) => IO.IO<void>;
  /** The host refused the change to that channel. */
  fail: (channelId: string, error: number) => IO.IO<void>;
}>;

export const createHostChannelChanges = (send: (message: PageMessage) => IO.IO<void>): HostChannelChanges => {
  const pending = new Map<string, ReadonlyArray<(result: Result) => void>>();

  const resolve =
    (channelId: string, result: Result): IO.IO<void> =>
    () => {
      const waiting = pending.get(channelId) ?? [];
      pending.delete(channelId);
      for (const settle of waiting) settle(result);
    };

  return {
    request: (channel) => () =>
      new Promise<Result>((settle) => {
        pending.set(channel.id, [...(pending.get(channel.id) ?? []), settle]);
        send({ _tag: "Page/SetChannel", channelId: channel.id })();
      }),
    settle: (session) => (session.channel ? resolve(session.channel.id, E.right(undefined)) : IO.of(undefined)),
    fail: (channelId, error) => resolve(channelId, E.left(error as OIPF.DAE.Broadcast.ChannelChangeErrorCode)),
  };
};
