import { type ClassType, createLogger } from "@hbb-emu/core";
import {
  type ChannelConfig,
  DEFAULT_EXTENSION_STATE,
  type ExtensionState,
  type MessageClient,
} from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import type { Render } from "./render";

const logger = createLogger("ExtensionUI:Bridge");

export const WithBridge = <T extends ClassType<Render & MessageClient>>(Base: T) =>
  class extends Base {
    override loadState = (): TE.TaskEither<Error, ExtensionState> =>
      pipe(
        this.send("BACKGROUND_SCRIPT", { type: "GET_STATE", payload: null }),
        TE.flatMap(() => this.once("STATE_UPDATED", 3000)),
        TE.map((envelope) => envelope.message.payload),
        TE.orElseFirstIOK(() => logger.info("State loaded from background script")),
        TE.orElse(() => TE.right(DEFAULT_EXTENSION_STATE)),
      );

    override saveState = (state: ExtensionState): TE.TaskEither<Error, void> =>
      TE.fromIO(() => {
        this.send("BACKGROUND_SCRIPT", { type: "STATE_UPDATED", payload: state })();
      });

    override playChannel = (channel: ChannelConfig): TE.TaskEither<Error, void> =>
      TE.fromIO(() => {
        this.send("BACKGROUND_SCRIPT", { type: "PLAY_CHANNEL", payload: channel })();
      });

    override dispatchKey = (keyCode: number): TE.TaskEither<Error, void> =>
      TE.fromIO(() => {
        this.send("BACKGROUND_SCRIPT", { type: "DISPATCH_KEY", payload: keyCode })();
      });
  };
