/**
 * Changing the channel of a tab's TV, from the settings UI or from its application
 * (`setChannel()`). The session changes first and the bootstrap says the new
 * channel, so the next page starts on it; then the page retunes, or the tab loads
 * what the new channel shows (`changeChannel`).
 */

import type { ChannelConfig } from "@hbb-emu/extension-common";
import { OIPF } from "@hbb-emu/oipf-api";
import type { HostMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import type * as RT from "fp-ts/ReaderTask";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { AdapterError, MessagingAdapter, TabsAdapter } from "../../adapter";
import {
  changeChannel,
  type ExtensionState,
  findChannel,
  mayChangeChannel,
  type TvPageUrl,
  type TvSession,
  toBootstrapData,
  toPageSession,
} from "../../state";
import type { PageBootstrap } from "./bootstrap";
import type { Sessions } from "./sessions";

export type TvEnv = Readonly<{
  messaging: MessagingAdapter<HostMessage>;
  tabs: TabsAdapter;
  pageBootstrap: PageBootstrap;
  sessions: Sessions;
  /** Where a TV shows a channel without application. */
  tvPage: TvPageUrl;
}>;

/** Pages loaded from now on get the configuration and the channel of each TV. */
export const republish =
  (state: ExtensionState): RT.ReaderTask<Pick<TvEnv, "pageBootstrap" | "sessions">, void> =>
  ({ pageBootstrap, sessions }) =>
    pageBootstrap.publish(toBootstrapData(state, sessions.all()));

/**
 * The TV in `tabId` changes to `channel`. Delivering the new session to the page is
 * best effort (e.g. the TV page has no bridge); loading another page is not.
 */
export const changeTabChannel =
  (
    tabId: number,
    state: ExtensionState,
    session: TvSession,
    channel: ChannelConfig,
  ): RT.ReaderTask<TvEnv, E.Either<AdapterError, void>> =>
  (env) => {
    const change = changeChannel(session, channel, env.tvPage);
    return pipe(
      TE.fromTask(env.sessions.update(tabId, () => change.session)),
      TE.tap(() => TE.fromTask(republish(state)(env))),
      TE.flatMap(() =>
        change.navigateTo === null
          ? pipe(
              env.messaging.sendToTab(tabId, { _tag: "Host/Session", session: toPageSession(state, change.session) }),
              TE.orElse(() => TE.right<AdapterError, void>(undefined)),
            )
          : env.tabs.navigate(tabId, change.navigateTo),
      ),
    );
  };

/** Why the TV did not change to the channel the application asked for. */
export type ChannelChangeRefusal = Readonly<{ error: OIPF.DAE.Broadcast.ChannelChangeErrorCode; reason: string }>;

const refused = (error: OIPF.DAE.Broadcast.ChannelChangeErrorCode, reason: string): ChannelChangeRefusal => ({
  error,
  reason,
});

/**
 * The application in `tabId` asks to change to `channelId` (`setChannel()`). A TV
 * changes channel as it does from the UI; an application opened on its own keeps
 * its channel, and gets "unknown channel" (ROADMAP D5).
 */
export const applicationChangesChannel =
  (
    tabId: number,
    channelId: string,
    state: ExtensionState,
  ): RT.ReaderTask<TvEnv, E.Either<ChannelChangeRefusal, void>> =>
  (env) => {
    const channel = findChannel(state, channelId);
    if (channel === null) {
      return T.of(E.left(refused(OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL, "not in the lineup")));
    }
    const session = env.sessions.get(tabId)();
    if (O.isNone(session)) {
      return T.of(E.left(refused(OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNIDENTIFIED_ERROR, "the tab is not a TV")));
    }
    if (!mayChangeChannel(session.value, channel)) {
      return T.of(
        E.left(
          refused(
            OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL,
            "the application runs on its own (app mode): only a TV turned on from the UI changes channel",
          ),
        ),
      );
    }
    return pipe(
      changeTabChannel(tabId, state, session.value, channel)(env),
      TE.mapLeft((error) => refused(OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNIDENTIFIED_ERROR, error._tag)),
    );
  };
