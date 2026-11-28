/**
 * Settings UI client: what an extension page (side panel, options) uses to talk to
 * the background. Host-agnostic; the UI framework glue lives in each extension.
 */

import { isUiNotification, isUiResponse, type UiRequest, type UiResponse, type UiState } from "@hbb-emu/protocol";
import type { ChannelConfig } from "@hbb-emu/state";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import type { ExtensionChannel } from "../../adapter/extensionChannel";

export type UiClientError = Readonly<{ _tag: "UiClientError"; reason: string }>;

export type UiClient = Readonly<{
  getState: () => TE.TaskEither<UiClientError, UiState>;
  saveState: (state: UiState) => TE.TaskEither<UiClientError, void>;
  dispatchKey: (keyCode: number) => TE.TaskEither<UiClientError, void>;
  playChannel: (channel: ChannelConfig) => TE.TaskEither<UiClientError, void>;
  /** Turns on a new TV (a new tab) on this channel. */
  turnOnTv: (channelId: string) => TE.TaskEither<UiClientError, void>;
  /** State changes made anywhere (another UI, the background). Returns the unsubscribe function. */
  subscribe: (listener: (state: UiState) => void) => () => void;
}>;

const error = (reason: string): UiClientError => ({ _tag: "UiClientError", reason });

const request = (channel: ExtensionChannel<UiRequest>, message: UiRequest): TE.TaskEither<UiClientError, UiResponse> =>
  pipe(
    channel.request(message),
    TE.mapLeft(() => error("The background is not reachable")),
    TE.flatMap((response) =>
      isUiResponse(response) ? TE.right(response) : TE.left(error(`Unexpected response to ${message._tag}`)),
    ),
    TE.flatMap((response) => (response._tag === "UI/Failed" ? TE.left(error(response.reason)) : TE.right(response))),
  );

const command = (channel: ExtensionChannel<UiRequest>, message: UiRequest): TE.TaskEither<UiClientError, void> =>
  pipe(request(channel, message), TE.asUnit);

export const createUiClient = (channel: ExtensionChannel<UiRequest>): UiClient => ({
  getState: () =>
    pipe(
      request(channel, { _tag: "UI/GetState" }),
      TE.flatMap((response) =>
        response._tag === "UI/State" ? TE.right(response.state) : TE.left(error("Unexpected response to UI/GetState")),
      ),
    ),
  saveState: (state) => command(channel, { _tag: "UI/SaveState", state }),
  dispatchKey: (keyCode) => command(channel, { _tag: "UI/DispatchKey", keyCode }),
  playChannel: (channelConfig) => command(channel, { _tag: "UI/PlayChannel", channel: channelConfig }),
  turnOnTv: (channelId) => command(channel, { _tag: "UI/TurnOnTv", channelId }),
  subscribe: (listener) =>
    channel.onMessage((message) => () => {
      if (isUiNotification(message)) listener(message.state);
    }),
});
