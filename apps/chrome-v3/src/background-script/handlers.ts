import { createLogger } from "@hbb-emu/core";
import type { ExtensionState, Handler, MessageEnvelope } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as N from "fp-ts/number";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RS from "fp-ts/ReadonlySet";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";
import { addTab, getConfig, getTabs, setConfig } from "./state";
import { saveConfigToStorage } from "./storage";
import { extractTabId, isNotSourceTab, type MissingTabIdError, missingTabIdError, validateTabId } from "./tab";

const logger = createLogger("BackgroundScript:Handlers");

export const onBridgeScriptReady =
  (app: Instance): Handler<{ type: "BRIDGE_SCRIPT_READY"; payload: null }> =>
  (envelope) =>
    runTask(
      pipe(
        TE.fromEither(validateTabId("BRIDGE_SCRIPT_READY envelope")(envelope)),
        TE.tapIO((tabId) => app.runState(addTab(tabId))),
        TE.flatMap((tabId) =>
          pipe(
            sendBridgeContext(app, tabId),
            TE.mapLeft((error) => missingTabIdError(String(error))),
          ),
        ),
        TE.matchE(
          (error: MissingTabIdError) => T.fromIO(logger.warn(error.message)),
          () => T.of(undefined),
        ),
      ),
    );

export const onBridgeContextReceived =
  (app: Instance): Handler<{ type: "BRIDGE_CONTEXT_RECEIVED"; payload: null }> =>
  (envelope) =>
    runTask(
      pipe(
        TE.fromEither(validateTabId("BRIDGE_CONTEXT_RECEIVED envelope")(envelope)),
        TE.tapIO((tabId) => logger.info(`Bridge context received for tab ${tabId}, injecting content script`)),
        TE.tapIO((tabId) => app.inject(tabId)),
        TE.matchE(
          (error: MissingTabIdError) => T.fromIO(logger.warn(error.message)),
          () => T.of(undefined),
        ),
      ),
    );

export const onGetState =
  (app: Instance): Handler<{ type: "GET_STATE"; payload: null }> =>
  (envelope) =>
    runTask(
      pipe(
        T.fromIO(logger.debug("GET_STATE request received")),
        T.flatMap(() => T.fromIO(app.runState(getConfig))),
        T.flatMap((config) =>
          pipe(
            app.reply(envelope, { type: "STATE_UPDATED", payload: config }),
            TE.matchE(
              (error) => T.fromIO(logger.error("Failed to send config:", error)),
              () => T.fromIO(logger.debug("Config sent")),
            ),
          ),
        ),
      ),
    );

export const onStateUpdated =
  (app: Instance): Handler<{ type: "STATE_UPDATED"; payload: ExtensionState }> =>
  (envelope) =>
    runTask(
      pipe(
        T.fromIO(logger.info("STATE_UPDATED received")),
        T.flatMap(() => T.fromIO(app.runState(setConfig(envelope.message.payload)))),
        T.flatMap(() => saveConfigToStorage(envelope.message.payload)),
        T.flatMap(() => broadcastConfigToTabs(app, envelope)),
      ),
    );

export const onContentScriptReady =
  (_app: Instance): Handler<{ type: "CONTENT_SCRIPT_READY"; payload: null }> =>
  (envelope) =>
    pipe(
      extractTabId(envelope),
      O.match(
        () => logger.info("Content script ready (unknown tab)"),
        (tabId) => logger.info(`Content script ready for tab ${tabId}`),
      ),
    );

export const onPlayChannel =
  (app: Instance): Handler<{ type: "PLAY_CHANNEL"; payload: ExtensionState["channels"][number] }> =>
  (envelope) =>
    runTask(
      pipe(
        T.fromIO(logger.info("PLAY_CHANNEL received, broadcasting to all HbbTV tabs")),
        T.flatMap(() => T.fromIO(app.runState(getTabs))),
        T.flatMap((tabs) =>
          pipe(
            tabs,
            RS.toReadonlyArray(N.Ord),
            RA.map((tabId) =>
              pipe(
                app.publish("CONTENT_SCRIPT", envelope.message, { tabId }),
                TE.matchE(
                  (error) => T.fromIO(logger.error(`Failed to send PLAY_CHANNEL to tab ${tabId}:`, error)),
                  () => T.fromIO(logger.debug(`PLAY_CHANNEL sent to tab ${tabId}`)),
                ),
              ),
            ),
            T.sequenceArray,
            T.asUnit,
          ),
        ),
      ),
    );

export const onDispatchKey =
  (app: Instance): Handler<{ type: "DISPATCH_KEY"; payload: number }> =>
  (envelope) =>
    runTask(
      pipe(
        T.fromIO(
          logger.info(`DISPATCH_KEY received (keyCode: ${envelope.message.payload}), broadcasting to all HbbTV tabs`),
        ),
        T.flatMap(() => T.fromIO(app.runState(getTabs))),
        T.flatMap((tabs) =>
          pipe(
            tabs,
            RS.toReadonlyArray(N.Ord),
            RA.map((tabId) =>
              pipe(
                app.publish("CONTENT_SCRIPT", envelope.message, { tabId }),
                TE.matchE(
                  (error) => T.fromIO(logger.error(`Failed to send DISPATCH_KEY to tab ${tabId}:`, error)),
                  () => T.fromIO(logger.debug(`DISPATCH_KEY sent to tab ${tabId}`)),
                ),
              ),
            ),
            T.sequenceArray,
            T.asUnit,
          ),
        ),
      ),
    );

const sendBridgeContext = (app: Instance, tabId: number): TE.TaskEither<unknown, void> =>
  app.publish("BRIDGE_SCRIPT", { type: "UPDATE_BRIDGE_CONTEXT", payload: { tabId } }, { tabId });

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
            RS.toReadonlyArray(N.Ord),
            RA.filter(isNotSourceTab(extractTabId(originalEnvelope))),
            RA.map((tabId) =>
              pipe(
                app.publish("CONTENT_SCRIPT", { type: "STATE_UPDATED", payload: config }, { tabId }),
                TE.matchE(
                  (error) => T.fromIO(logger.error(`Failed to send config to tab ${tabId}:`, error)),
                  () => T.fromIO(logger.debug(`Config sent to tab ${tabId}`)),
                ),
              ),
            ),
            T.sequenceArray,
            T.asUnit,
          ),
        ),
      ),
    ),
  );

// TODO: Comporre le pipeline come IO o aggiungere il supporto agli handlers asincroni
const runTask =
  <A>(task: T.Task<A>): IO.IO<void> =>
  () => {
    void task();
  };
