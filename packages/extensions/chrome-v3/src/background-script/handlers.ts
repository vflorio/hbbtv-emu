import { createLogger, type ExtensionConfig } from "@hbb-emu/core";
import type { Handler, MessageEnvelope } from "@hbb-emu/core/message-bus";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
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
import { extractTabId, isNotSourceTab, validateTabId } from "./tab";

const logger = createLogger("BackgroundScript:Handlers");

const onBridgeScriptReady =
  (app: Instance): Handler<{ type: "BRIDGE_SCRIPT_READY"; payload: null }> =>
  (envelope) =>
    pipe(
      logger.info("Bridge ready, injecting content script"),
      IO.flatMap(() =>
        pipe(
          validateTabId("BRIDGE_SCRIPT_READY envelope")(envelope),
          E.match(
            (error) => logger.warn(error.message),
            (tabId) =>
              pipe(
                app.runState(addTab(tabId)),
                IO.flatMap(() => app.inject(tabId)),
                IO.tap(() => logger.debug(`Content script injected for tab ${tabId}`)),
                IO.tap(() =>
                  IO.of(
                    // TODO: Fixme
                    pipe(
                      sendBridgeContext(app, tabId),
                      TE.matchE(
                        (error) => T.fromIO(logger.error("Failed to send bridge context:", error)),
                        () => T.fromIO(logger.debug(`Bridge context sent to tab ${tabId}`)),
                      ),
                    )(),
                  ),
                ),
              ),
          ),
        ),
      ),
    );

// Send UPDATE_BRIDGE_CONTEXT to the bridge in the specified tab
const sendBridgeContext = (app: Instance, tabId: number): TE.TaskEither<unknown, void> =>
  app.publish("BRIDGE_SCRIPT", { type: "UPDATE_BRIDGE_CONTEXT", payload: { tabId } }, { tabId });

const onGetState =
  (app: Instance): Handler<{ type: "GET_STATE"; payload: null }> =>
  (envelope) =>
    pipe(
      logger.debug("GET_STATE request received"),
      IO.flatMap(() => app.runState(getConfig)),
      IO.flatMap((config) =>
        IO.of(
          pipe(
            app.reply(envelope, { type: "STATE_UPDATED", payload: config }),
            TE.matchE(
              (error) => T.fromIO(logger.error("Failed to send config:", error)),
              () => T.fromIO(logger.debug("Config sent")),
            ),
          )(),
        ),
      ),
      IO.map(() => undefined),
    );

const onStateUpdated =
  (app: Instance): Handler<{ type: "STATE_UPDATED"; payload: ExtensionConfig.State }> =>
  (envelope) =>
    pipe(
      logger.info("STATE_UPDATED received"),
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

const onContentScriptReady =
  (app: Instance): Handler<{ type: "CONTENT_SCRIPT_READY"; payload: null }> =>
  (envelope) =>
    pipe(
      extractTabId(envelope),
      O.match(
        () => logger.info("Content script ready (unknown tab)"),
        (tabId) =>
          pipe(
            logger.info(`Content script ready for tab ${tabId}`),
            IO.flatMap(() => app.runState(addTab(tabId))), // FIXME
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
            RS.toReadonlyArray(N.Ord),
            RA.filter(isNotSourceTab(extractTabId(originalEnvelope))),
            RA.map((tabId) =>
              pipe(
                app.publish("CONTENT_SCRIPT", { type: "STATE_UPDATED", payload: config }),
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
    logger.info("Registering handlers"),
    IO.flatMap(() => app.subscribe("CONTENT_SCRIPT_READY", onContentScriptReady(app))),
    IO.flatMap(() => app.subscribe("BRIDGE_SCRIPT_READY", onBridgeScriptReady(app))),
    IO.flatMap(() => app.subscribe("GET_STATE", onGetState(app))),
    IO.flatMap(() => app.subscribe("STATE_UPDATED", onStateUpdated(app))),
  );
