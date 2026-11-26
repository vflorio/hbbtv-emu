/**
 * Settings UI requests, handled by the background.
 *
 * The UI saves whole snapshots; the background turns each save into:
 * - the new configuration for every page (channels, user agent, …);
 * - a minimal patch of OIPF object state, only for the TV the user is looking at
 *   (the active tab), so nothing the applications did is overwritten (ROADMAP D5).
 *
 * The current channel the UI shows and plays is the one of the active tab's TV session
 * (`changeTabChannel`, the same change an application asks for). The UI also turns
 * on new TVs (TV mode, ROADMAP D5).
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
import type { UiAdapter, UserAgentAdapter } from "../../adapter";
import {
  type ExtensionState,
  findChannel,
  fromUiState,
  sessionChannel,
  type TvSession,
  toPageConfig,
  toUiState,
  turnedOnSession,
  zapChannel,
} from "../../state";
import { changeTabChannel, republish, type TvEnv } from "./channel";
import type { StateManager } from "./managers/state";

export type UiEnv = TvEnv &
  Readonly<{
    stateManager: StateManager;
    ui: UiAdapter;
    userAgent: UserAgentAdapter;
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
              republish(after)(env),
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

/** Every open UI shows the channel of the active tab's TV. */
export const notifyUis =
  (state: ExtensionState): RT.ReaderTask<UiEnv, void> =>
  (env) =>
    pipe(
      uiStateOf(state)(env),
      T.flatMap((ui) => env.ui.notify({ _tag: "UI/StateChanged", state: ui })),
    );

/**
 * Changes the channel of the TV in the active tab (`changeTabChannel`) to the one
 * `choose` picks for it, or fails with the reason `choose` gives.
 */
const changeActiveTabChannel =
  (
    choose: (state: ExtensionState, session: TvSession) => E.Either<string, ChannelConfig>,
  ): RT.ReaderTask<UiEnv, UiResponse> =>
  (env) =>
    pipe(
      T.Do,
      T.bind("state", () => readState(env)),
      T.bind("tabId", () => activeTabId(env)),
      T.flatMap(({ state, tabId }) => {
        if (O.isNone(state)) return T.of(failed("State not initialized"));
        if (O.isNone(tabId)) return T.of(failed("No active tab"));
        const current = env.sessions.get(tabId.value)();
        if (O.isNone(current)) return T.of(notAnEmulatedTab(tabId.value));
        const chosen = choose(state.value, current.value);
        if (E.isLeft(chosen)) return T.of(failed(chosen.left));
        const channel = chosen.right;
        return pipe(
          changeTabChannel(tabId.value, state.value, current.value, channel)(env),
          TE.tap(() => TE.fromTask(notifyUis(state.value)(env))),
          TE.match(
            (error) => failed(`Could not change channel (${error._tag})`),
            () => done,
          ),
        );
      }),
    );

/** "Play" in the UI: the active tab's TV changes to that channel. */
const playChannel = (request: Extract<UiRequest, { _tag: "UI/PlayChannel" }>): RT.ReaderTask<UiEnv, UiResponse> =>
  changeActiveTabChannel((state) =>
    E.fromNullable(`Unknown channel: ${request.channel.id}`)(findChannel(state, request.channel.id)),
  );

/**
 * P+/P- belong to the TV, not to the application (TS 102 796 §10.2.2.1, Table 12):
 * the active tab's TV zaps to the next or previous channel of the lineup.
 */
const CHANNEL_KEY_STEPS: Readonly<Record<number, 1 | -1>> = { 427: 1, 428: -1 };

const zap = (step: 1 | -1): RT.ReaderTask<UiEnv, UiResponse> =>
  changeActiveTabChannel((state, session) => E.fromNullable("The lineup is empty")(zapChannel(state, session, step)));

/** A key of the UI's remote: P+/P- zap the TV; the page decides about the others. */
const pressKey = (keyCode: number): RT.ReaderTask<UiEnv, UiResponse> => {
  const step = CHANNEL_KEY_STEPS[keyCode];
  return step === undefined ? toActiveTab({ _tag: "Host/DispatchKey", keyCode }) : zap(step);
};

/**
 * Turns on a new TV on a channel: a new tab whose session (TV mode) is open, and
 * published in the bootstrap, before the tab loads the channel's page. So the
 * application's first script already sees the channel, even when other channels
 * signal the same application.
 */
const turnOnTv =
  (request: Extract<UiRequest, { _tag: "UI/TurnOnTv" }>): RT.ReaderTask<UiEnv, UiResponse> =>
  (env) =>
    pipe(
      readState(env),
      T.flatMap(
        O.match(
          () => T.of(failed("State not initialized")),
          (state) => {
            const channel = findChannel(state, request.channelId);
            if (channel === null) return T.of(failed(`Unknown channel: ${request.channelId}`));
            const session = turnedOnSession(channel, env.tvPage);
            return pipe(
              env.tabs.create("about:blank"),
              TE.tap((tabId) => TE.fromTask(env.sessions.open(tabId, session))),
              TE.tap(() => TE.fromTask(republish(state)(env))),
              TE.tap((tabId) => env.tabs.navigate(tabId, session.url)),
              TE.tapIO((tabId) => env.logger.info(`TV turned on in tab ${tabId}`, session)),
              TE.tap(() => TE.fromTask(notifyUis(state)(env))),
              TE.match(
                (error) => failed(`Could not turn on the TV (${error._tag})`),
                () => done,
              ),
            );
          },
        ),
      ),
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
        return pressKey(request.keyCode)(env);
      case "UI/PlayChannel":
        return playChannel(request)(env);
      case "UI/TurnOnTv":
        return turnOnTv(request)(env);
    }
  };
