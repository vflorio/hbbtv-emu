import { createLogger, DEFAULT_HBBTV_CONFIG, ExtensionConfig, Storage } from "@hbb-emu/core";
import { ChromeStorageAdapter } from "@hbb-emu/runtime-chrome";
import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";
import { setConfig } from "./state";

const logger = createLogger("BackgroundScript:Storage");

const storageAdapter = new ChromeStorageAdapter();

export const configStorage = new Storage<ExtensionConfig.State>(
  "hbbtv-config",
  storageAdapter,
  ExtensionConfig.StateCodec,
);

export const loadConfigFromStorage = (app: Instance): T.Task<void> =>
  pipe(
    TE.fromIO(logger.debug("Loading config from storage")),
    TE.flatMap(() => configStorage.load()),
    TE.matchE(
      (error) =>
        pipe(
          T.fromIO(logger.warn("Failed to load config, using defaults:", error)),
          T.flatMap(() => T.fromIO(app.runState(setConfig(DEFAULT_HBBTV_CONFIG)))),
        ),
      (config) =>
        pipe(
          T.fromIO(logger.debug("Config loaded from storage")),
          T.flatMap(() => T.fromIO(app.runState(setConfig(config)))),
        ),
    ),
  );

export const saveConfigToStorage = (config: ExtensionConfig.State): T.Task<void> =>
  pipe(
    TE.fromIO(logger.debug("Saving config to storage")),
    TE.flatMap(() => configStorage.save(config)),
    TE.matchE(
      (error) => T.fromIO(logger.error("Failed to save config:", error)),
      () => T.fromIO(logger.debug("Config saved to storage")),
    ),
  );
