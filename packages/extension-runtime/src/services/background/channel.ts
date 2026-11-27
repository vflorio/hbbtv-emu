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
import type { AdapterError, BroadbandAdapter, MessagingAdapter, TabsAdapter } from "../../adapter";
import {
  type AssetUrl,
  changeChannel,
  type ExtensionState,
  exitApplication,
  findChannel,
  launchApplication,
  mayChangeChannel,
  sessionChannel,
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
  /** Where the files the emulator ships are, for the pages. */
  assetUrl: AssetUrl;
  /** What the TV fetches for itself: the first page of an application it starts, to check it. */
  broadband: BroadbandAdapter;
}>;

/** Pages loaded from now on get the configuration and the channel of each TV. */
export const republish =
  (state: ExtensionState): RT.ReaderTask<Pick<TvEnv, "pageBootstrap" | "sessions" | "assetUrl">, void> =>
  ({ pageBootstrap, sessions, assetUrl }) =>
    pageBootstrap.publish(toBootstrapData(state, sessions.all(), assetUrl));

/**
 * The TV in `tabId` changes to `channel`. The page gets the new session even when the
 * channel shows another page, before that page loads: a TV tunes first, and only then
 * does the new service's AIT end the application, so its `setChannel()` succeeds.
 * Delivering the session is best effort (e.g. the TV page has no bridge); loading
 * another page is not.
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
        pipe(
          env.messaging.sendToTab(tabId, {
            _tag: "Host/Session",
            session: toPageSession(state, change.session, env.assetUrl),
          }),
          TE.orElse(() => TE.right<AdapterError, void>(undefined)),
        ),
      ),
      TE.flatMap(() =>
        change.navigateTo === null ? TE.right(undefined) : env.tabs.navigate(tabId, change.navigateTo),
      ),
    );
  };

/**
 * The application in `tabId` exits (`destroyApplication()`): the TV, still on its
 * channel, loads what that channel's AIT starts (`exitApplication`), its channel
 * already in the bootstrap. Loading it ends the application. `false` when the tab
 * loads nothing: it is not a TV, or its lineup is empty.
 */
export const exitTabApplication =
  (tabId: number, state: ExtensionState): RT.ReaderTask<TvEnv, E.Either<AdapterError, boolean>> =>
  (env) => {
    const session = env.sessions.get(tabId)();
    if (O.isNone(session)) return T.of(E.right(false));
    const exit = exitApplication(session.value, sessionChannel(state, session.value), env.tvPage);
    const navigateTo = exit.navigateTo;
    if (navigateTo === null) return T.of(E.right(false));
    return pipe(
      TE.fromTask(env.sessions.update(tabId, () => exit.session)),
      TE.tap(() => TE.fromTask(republish(state)(env))),
      TE.flatMap(() => env.tabs.navigate(tabId, navigateTo)),
      TE.map(() => true),
    );
  };

/**
 * What the TV accepts as an application's first page: an HTML document (HbbTV's own
 * content type, XHTML, HTML), or a response that does not say. An XML AIT, which
 * would start a broadcast-independent application with its ids (§6.2.2.6.1), is not
 * supported yet.
 */
const isApplicationPage = (contentType: string | null): boolean =>
  contentType === null || /hbbtv|html/i.test(contentType);

/**
 * Whether the TV can load the first page at `url` (OIPF DAE §7.2.1.3: an HTTP error, a
 * timeout, a file that is not HTML), and why not. The TV fetches it once to check,
 * so the application that asked is still there to hear it; the tab then loads it.
 */
const checkApplicationPage =
  (url: string): RT.ReaderTask<Pick<TvEnv, "broadband">, E.Either<string, void>> =>
  ({ broadband }) =>
    pipe(
      broadband.fetchText(url),
      TE.mapLeft((error) =>
        error._tag === "BroadbandFetchError" && error.cause instanceof Error ? error.cause.message : error._tag,
      ),
      TE.flatMap(({ contentType }) =>
        isApplicationPage(contentType) ? TE.right(undefined) : TE.left(`not an application page (${contentType})`),
      ),
    );

/**
 * The application in `tabId` starts another at `url` (`createApplication()`): the TV
 * checks its first page, then loads it in the tab, its channel (or none) already in
 * the bootstrap (`launchApplication`). Loading it ends the application that asked.
 * Fails with the reason the application hears as `ApplicationLoadError`.
 */
export const launchTabApplication =
  (tabId: number, url: string, state: ExtensionState): RT.ReaderTask<TvEnv, E.Either<string, void>> =>
  (env) => {
    const session = env.sessions.get(tabId)();
    if (O.isNone(session)) return T.of(E.left("the tab is not a TV"));
    const launch = launchApplication(session.value, sessionChannel(state, session.value), url);
    if (launch._tag === "fail") return T.of(E.left(launch.reason));
    return pipe(
      checkApplicationPage(launch.navigateTo)(env),
      TE.flatMap(() =>
        pipe(
          TE.fromTask(env.sessions.update(tabId, () => launch.session)),
          TE.tap(() => TE.fromTask(republish(state)(env))),
          TE.flatMap(() => env.tabs.navigate(tabId, launch.navigateTo)),
          TE.mapLeft((error) => error._tag),
        ),
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
