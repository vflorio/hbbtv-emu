import { createLogger, type ExtensionConfig } from "@hbb-emu/core";
import type { Handler, MessageEnvelope } from "@hbb-emu/core/message-bus";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as N from "fp-ts/number";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RS from "fp-ts/ReadonlySet";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";
import { addTab, getConfig, getTabs, setConfig } from "./state";
import { saveConfigToStorage } from "./storage";

const logger = createLogger("BackgroundScript:Handlers");

type MissingTabIdError = Readonly<{ type: "MissingTabIdError"; message: string }>;

const missingTabIdError = (context: string): MissingTabIdError => ({
  type: "MissingTabIdError",
  message: `Missing tabId in ${context}`,
});

const extractTabId = (envelope: MessageEnvelope): O.Option<number> => O.fromNullable(envelope.context?.tabId);

const validateTabId = (context: string) =>
  flow(
    extractTabId,
    E.fromOption(() => missingTabIdError(context)),
  );

const isNotSourceTab =
  (sourceTabId: O.Option<number>) =>
  (tabId: number): boolean =>
    pipe(
      sourceTabId,
      O.match(
        () => true,
        (srcId) => tabId !== srcId,
      ),
    );

const tabsToArray = (tabs: ReadonlySet<number>): ReadonlyArray<number> => RS.toReadonlyArray(N.Ord)(tabs);

export const handleBridgeReady =
  (app: Instance): Handler<{ type: "BRIDGE_READY"; payload: null }> =>
  (envelope) =>
    pipe(
      logger.info("Bridge ready, injecting content script"),
      IO.flatMap(() =>
        pipe(
          validateTabId("BRIDGE_READY envelope")(envelope),
          E.match(
            (error) => logger.warn(error.message),
            (tabId) =>
              pipe(
                app.runState(addTab(tabId)),
                IO.flatMap(() => app.injectContentScript(tabId)),
                IO.tap(() => logger.debug(`Content script injected for tab ${tabId}`)),
              ),
          ),
        ),
      ),
    );

export const handleGetConfig =
  (app: Instance): Handler<{ type: "GET_CONFIG"; payload: null }> =>
  (envelope) =>
    pipe(
      logger.debug("GET_CONFIG request received"),
      IO.flatMap(() => app.runState(getConfig)),
      IO.flatMap((config) =>
        IO.of(
          pipe(
            app.reply(envelope, { type: "UPDATE_CONFIG", payload: config }),
            TE.matchE(
              (error) => T.fromIO(logger.error("Failed to send config:", error)),
              () => T.fromIO(logger.debug("Config sent")),
            ),
          )(),
        ),
      ),
      IO.map(() => undefined),
    );

export const handleUpdateConfig =
  (app: Instance): Handler<{ type: "UPDATE_CONFIG"; payload: ExtensionConfig.State }> =>
  (envelope) =>
    pipe(
      logger.info("UPDATE_CONFIG received"),
      IO.flatMap(() => app.runState(setConfig(envelope.message.payload))),
      IO.flatMap(() =>
        IO.of(
          pipe(
            saveConfigToStorage(envelope.message.payload),
            T.flatMap(() => broadcastConfigToTabs(app, envelope)),
          )(),
        ),
      ),
      IO.map(() => undefined),
    );

export const handleContentScriptReady =
  (app: Instance): Handler<{ type: "CONTENT_SCRIPT_READY"; payload: null }> =>
  (envelope) =>
    pipe(
      extractTabId(envelope),
      O.match(
        () => logger.info("Content script ready (unknown tab)"),
        (tabId) =>
          pipe(
            logger.info(`Content script ready for tab ${tabId}`),
            IO.flatMap(() => app.runState(addTab(tabId))),
          ),
      ),
    );

const broadcastConfigToTabs = (app: Instance, originalEnvelope: MessageEnvelope): T.Task<void> =>
  pipe(
    T.fromIO(logger.debug("Broadcasting config to all HbbTV tabs")),
    T.flatMap(() => T.fromIO(app.runState(getConfig))),
    T.flatMap((config) =>
      pipe(
        T.fromIO(app.runState(getTabs)),
        T.flatMap((tabs) =>
          pipe(
            tabs,
            tabsToArray,
            RA.filter(isNotSourceTab(extractTabId(originalEnvelope))),
            RA.map((tabId) =>
              pipe(
                app.publish("CONTENT_SCRIPT", { type: "UPDATE_CONFIG", payload: config }),
                TE.matchE(
                  (error) => T.fromIO(logger.error(`Failed to send config to tab ${tabId}:`, error)),
                  () => T.fromIO(logger.debug(`Config sent to tab ${tabId}`)),
                ),
              ),
            ),
            T.sequenceArray,
            T.map(() => undefined),
          ),
        ),
      ),
    ),
  );

export const registerHandlers = (app: Instance): IO.IO<void> =>
  pipe(
    app.subscribe("BRIDGE_READY", handleBridgeReady(app)),
    IO.flatMap(() => app.subscribe("GET_CONFIG", handleGetConfig(app))),
    IO.flatMap(() => app.subscribe("UPDATE_CONFIG", handleUpdateConfig(app))),
    IO.flatMap(() => app.subscribe("CONTENT_SCRIPT_READY", handleContentScriptReady(app))),
  );
