import { type ClassType, createLogger } from "@hbb-emu/core";
import {
  type ChannelConfig,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionState,
  type MessageClient,
} from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Render } from "./render";

const logger = createLogger("ExtensionUI:Bridge");

export const WithBridge = <T extends ClassType<Render & MessageClient>>(Base: T) =>
  class extends Base {
    override loadState = (): Promise<ExtensionState> =>
      pipe(
        T.fromIO(this.send("BACKGROUND_SCRIPT", { type: "GET_STATE", payload: null })),
        T.flatMap(() => this.once("STATE_UPDATED", 3000)),
        TE.matchE(
          (error) =>
            pipe(
              T.fromIO(logger.warn("Failed to load state, using default:", error.message)),
              T.map(() => DEFAULT_HBBTV_CONFIG),
            ),
          (envelope) => T.of(envelope.message.payload as ExtensionState),
        ),
      )();

    override saveState = (state: ExtensionState): Promise<void> =>
      pipe(T.fromIO(this.send("BACKGROUND_SCRIPT", { type: "STATE_UPDATED", payload: state })), T.asUnit)();

    override playChannel = (channel: ChannelConfig): Promise<void> =>
      pipe(T.fromIO(this.send("BACKGROUND_SCRIPT", { type: "PLAY_CHANNEL", payload: channel })), T.asUnit)();
  };
