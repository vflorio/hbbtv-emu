import { createLogger, type ExtensionConfig } from "@hbb-emu/core";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";
import { type ConfigUpdateError, configNotAvailableError, configUpdateError, type OperationError } from "./errors";
import { getConfig } from "./state";

const logger = createLogger("UI:Operations");

export const updateChannelInConfig =
  (channel: ExtensionConfig.Channel) =>
  (config: ExtensionConfig.State): ExtensionConfig.State => ({
    ...config,
    channels: config.channels.map((c) => (c.id === channel.id ? channel : c)),
  });

export const setCurrentChannelInConfig =
  (channel: ExtensionConfig.Channel | null) =>
  (config: ExtensionConfig.State): ExtensionConfig.State => ({
    ...config,
    currentChannel: channel,
  });

export const sendConfigUpdate =
  (app: Instance) =>
  (config: ExtensionConfig.State): TE.TaskEither<ConfigUpdateError, void> =>
    pipe(
      TE.tryCatch(
        () => app.send("BACKGROUND_SCRIPT", { type: "STATE_UPDATED", payload: config })(),
        (error): ConfigUpdateError => configUpdateError(String(error)),
      ),
      TE.flatMap((result) =>
        E.isLeft(result) ? TE.left(configUpdateError(String(result.left))) : TE.right(undefined),
      ),
      TE.tapIO(() => logger.info("Config update sent to background")),
    );

export const updateConfig =
  (app: Instance) =>
  (config: ExtensionConfig.State): TE.TaskEither<ConfigUpdateError, void> =>
    sendConfigUpdate(app)(config);

export const updateChannel =
  (app: Instance) =>
  (channel: ExtensionConfig.Channel): TE.TaskEither<OperationError, void> =>
    pipe(
      TE.fromIO(app.runState(getConfig)),
      TE.flatMap(
        O.match(
          () => TE.left<OperationError, ExtensionConfig.State>(configNotAvailableError()),
          (config) => TE.right(updateChannelInConfig(channel)(config)),
        ),
      ),
      TE.flatMap(sendConfigUpdate(app)),
    );

export const setCurrentChannel =
  (app: Instance) =>
  (channel: ExtensionConfig.Channel | null): TE.TaskEither<OperationError, void> =>
    pipe(
      TE.fromIO(app.runState(getConfig)),
      TE.flatMap(
        O.match(
          () => TE.left<OperationError, ExtensionConfig.State>(configNotAvailableError()),
          (config) => TE.right(setCurrentChannelInConfig(channel)(config)),
        ),
      ),
      TE.flatMap(sendConfigUpdate(app)),
    );
