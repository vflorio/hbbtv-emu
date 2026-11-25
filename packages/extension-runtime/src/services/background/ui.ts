/**
 * Settings UI requests, handled by the background.
 *
 * The UI saves whole snapshots; the background turns each save into:
 * - the new configuration for every page (channels, user agent, …);
 * - a minimal patch of OIPF object state, only for the TV the user is looking at
 *   (the active tab), so nothing the applications did is overwritten (ROADMAP D5).
 *
 * The current channel the UI shows and plays is the one of the active tab's TV session.
 */

import { diffPatch, type Logger } from "@hbb-emu/core";
import type { ChannelConfig } from "@hbb-emu/extension-common";
import type { HbbTVState } from "@hbb-emu/oipf-api";
import type { HostMessage, UiRequest, UiResponse, UiState } from "@hbb-emu/protocol";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import type * as RT from "fp-ts/ReaderTask";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { MessagingAdapter, TabsAdapter, UiAdapter, UserAgentAdapter } from "../../adapter";
import {
  type ExtensionState,
  findChannel,
  fromUiState,
  sessionChannel,
  toPageConfig,
  toPageSession,
  toUiState,
} from "../../state";
import type { PageBootstrap } from "./bootstrap";
import type { StateManager } from "./managers/state";
import type { Sessions } from "./sessions";

export type UiEnv = Readonly<{
  stateManager: StateManager;
  messaging: MessagingAdapter<HostMessage>;
  tabs: TabsAdapter;
  ui: UiAdapter;
  userAgent: UserAgentAdapter;
  pageBootstrap: PageBootstrap;
  sessions: Sessions;
  logger: Logger;
}>;

const done: UiResponse = { _tag: "UI/Done" };
const failed = (reason: string): UiResponse => ({ _tag: "UI/Failed", reason });

const readState: RT.ReaderTask<UiEnv, O.Option<ExtensionState>> = ({ stateManager }) =>
  T.fromIO(() => O.fromEither(stateManager.getState()()));

/** Delivery failures (e.g. a tab without the bridge, like chrome:// pages) are expected and ignored. */
const sendTo =
  (tabIds: ReadonlyArray<number>, message: HostMessage): RT.ReaderTask<UiEnv, void> =>
  ({ messaging }) =>
    pipe(
      [...tabIds],
      A.map((tabId) => pipe(messaging.sendToTab(tabId, message), T.map(E.getOrElseW(() => undefined)))),
      T.sequenceArray,
      T.map(() => undefined),
    );

const allTabIds: RT.ReaderTask<UiEnv, ReadonlyArray<number>> = ({ tabs }) =>
  pipe(
    tabs.query({}),
    T.map((found) => found.map((tab) => tab.id)),
  );

/** The tab the user is looking at: the side panel sits next to it. */
const activeTabId: RT.ReaderTask<UiEnv, O.Option<number>> = ({ tabs }) =>
  pipe(
    tabs.query({ active: true, lastFocusedWindow: true }),
    T.map((found) => O.fromNullable(found[0]?.id)),
  );

/** The channel of the TV in the active tab; `null` if that tab is not a TV. */
const activeChannel =
  (state: ExtensionState): RT.ReaderTask<UiEnv, ChannelConfig | null> =>
  (env) =>
    pipe(
      activeTabId(env),
      T.map((tabId) =>
        pipe(
          tabId,
          O.flatMap((id) => env.sessions.get(id)()),
          O.match(
            () => null,
            (session) => sessionChannel(state, session),
          ),
        ),
      ),
    );

const uiStateOf =
  (state: ExtensionState): RT.ReaderTask<UiEnv, UiState> =>
  (env) =>
    pipe(
      activeChannel(state)(env),
      T.map((channel) => toUiState(state, channel)),
    );

const notAnEmulatedTab = (tabId: number) => failed(`The active tab does not run the emulator (tab ${tabId})`);

const toActiveTab =
  (message: HostMessage): RT.ReaderTask<UiEnv, UiResponse> =>
  (env) =>
    pipe(
      activeTabId(env),
      T.flatMap(
        O.match(
          () => T.of(failed("No active tab")),
          (tabId) =>
            pipe(
              env.messaging.sendToTab(tabId, message),
              TE.match(
                () => notAnEmulatedTab(tabId),
                () => done,
              ),
            ),
        ),
      ),
    );

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The HTTP user agent; the pages get theirs with the configuration. */
const applyUserAgent =
  (before: ExtensionState, after: ExtensionState): RT.ReaderTask<UiEnv, void> =>
  ({ userAgent, logger }) =>
    before.runtime.userAgent === after.runtime.userAgent
      ? T.of(undefined)
      : pipe(
          userAgent.setUserAgent(after.runtime.userAgent),
          TE.getOrElseW((error) => T.fromIO(logger.error("Could not set the HTTP user agent", error))),
        );

const propagate =
  (before: ExtensionState, after: ExtensionState): RT.ReaderTask<UiEnv, void> =>
  (env) =>
    pipe(
      applyUserAgent(before, after)(env),
      T.flatMap(() =>
        sameJson(toPageConfig(before), toPageConfig(after))
          ? T.of(undefined)
          : pipe(
              // Pages loaded from now on start with it; open pages get it as a message.
              env.pageBootstrap.publish(toPageConfig(after)),
              T.flatMap(() => allTabIds(env)),
              T.flatMap((ids) => sendTo(ids, { _tag: "Host/Config", config: toPageConfig(after) })(env)),
            ),
      ),
      T.flatMap(() =>
        pipe(
          diffPatch(before.runtime.api, after.runtime.api),
          O.match(
            () => T.of(undefined),
            (patch) =>
              pipe(
                activeTabId(env),
                T.flatMap(
                  O.match(
                    () => T.of(undefined),
                    (tabId) => sendTo([tabId], { _tag: "Host/ApplyState", patch: patch as Partial<HbbTVState> })(env),
                  ),
                ),
              ),
          ),
        ),
      ),
    );

const saveState =
  (request: Extract<UiRequest, { _tag: "UI/SaveState" }>): RT.ReaderTask<UiEnv, UiResponse> =>
  (env) =>
    pipe(
      readState(env),
      T.flatMap(
        O.match(
          () => T.of(failed("State not initialized")),
          (before) =>
            pipe(
              env.stateManager.updateState((current) => fromUiState(current, request.state)),
              T.flatMap(() => readState(env)),
              T.flatMap(
                O.match(
                  () => T.of(failed("State not initialized")),
                  (after) =>
                    pipe(
                      propagate(before, after)(env),
                      T.flatMap(() => uiStateOf(after)(env)),
                      T.flatMap((state) => env.ui.notify({ _tag: "UI/StateChanged", state })),
                      T.map(() => done),
                    ),
                ),
              ),
            ),
        ),
      ),
    );

/** Tunes the TV in the active tab: its session changes, then the page follows. */
const playChannel =
  (request: Extract<UiRequest, { _tag: "UI/PlayChannel" }>): RT.ReaderTask<UiEnv, UiResponse> =>
  (env) =>
    pipe(
      T.Do,
      T.bind("state", () => readState(env)),
      T.bind("tabId", () => activeTabId(env)),
      T.flatMap(({ state, tabId }) => {
        if (O.isNone(state)) return T.of(failed("State not initialized"));
        if (O.isNone(tabId)) return T.of(failed("No active tab"));
        const channel = findChannel(state.value, request.channel.id);
        if (channel === null) return T.of(failed(`Unknown channel: ${request.channel.id}`));
        return pipe(
          env.sessions.update(tabId.value, (session) => ({ ...session, channelId: channel.id })),
          T.flatMap(
            O.match(
              () => T.of(notAnEmulatedTab(tabId.value)),
              (session) =>
                pipe(
                  sendTo([tabId.value], { _tag: "Host/Session", session: toPageSession(state.value, session) })(env),
                  T.flatMap(() => uiStateOf(state.value)(env)),
                  T.flatMap((ui) => env.ui.notify({ _tag: "UI/StateChanged", state: ui })),
                  T.map(() => done),
                ),
            ),
          ),
        );
      }),
    );

export const handleUiRequest =
  (request: UiRequest): RT.ReaderTask<UiEnv, UiResponse> =>
  (env) => {
    switch (request._tag) {
      case "UI/GetState":
        return pipe(
          readState(env),
          T.flatMap(
            O.match(
              () => T.of(failed("State not initialized")),
              (state) =>
                pipe(
                  uiStateOf(state)(env),
                  T.map((ui): UiResponse => ({ _tag: "UI/State", state: ui })),
                ),
            ),
          ),
        );
      case "UI/SaveState":
        return saveState(request)(env);
      case "UI/DispatchKey":
        return toActiveTab({ _tag: "Host/DispatchKey", keyCode: request.keyCode })(env);
      case "UI/PlayChannel":
        return playChannel(request)(env);
    }
  };
