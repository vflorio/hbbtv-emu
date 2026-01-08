import { type ClassType, createLogger, notImplementedError, querySelector } from "@hbb-emu/core";
import type { ChannelConfig, ExtensionState } from "@hbb-emu/extension-common";
import { Settings, type SideEffects } from "@hbb-emu/settings-ui";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RS from "fp-ts/ReadonlySet";
import * as TE from "fp-ts/TaskEither";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type AppStateManager,
  addStateChangeListener,
  getStateChangeListeners,
  removeStateChangeListener,
  type StateChangeListener,
  stateChangeListenerOrd,
} from "./state";

const logger = createLogger("ExtensionUI:Render");

export interface Render {
  render: IO.IO<void>;
  notifyStateUpdate: (state: ExtensionState) => IO.IO<void>;
  subscribe: (callback: StateChangeListener) => IO.IO<void>;
  // overrides
  loadState: () => TE.TaskEither<unknown, ExtensionState>;
  saveState: (state: ExtensionState) => TE.TaskEither<unknown, void>;
  playChannel: (channel: ChannelConfig) => TE.TaskEither<unknown, void>;
  dispatchKey: (keyCode: number) => TE.TaskEither<unknown, void>;
}

export const WithRender = <T extends ClassType<AppStateManager>>(Base: T) =>
  class extends Base implements Render {
    loadState = (): TE.TaskEither<unknown, ExtensionState> => TE.left(notImplementedError("loadState not implemented"));

    saveState = (_state: ExtensionState): TE.TaskEither<unknown, void> =>
      TE.left(notImplementedError("saveState not implemented"));

    playChannel = (_channel: ChannelConfig): TE.TaskEither<unknown, void> =>
      TE.left(notImplementedError("playChannel not implemented"));

    dispatchKey = (_keyCode: number): TE.TaskEither<unknown, void> =>
      TE.left(notImplementedError("dispatchKey not implemented"));

    subscribe = (callback: StateChangeListener): IO.IO<void> => {
      this.runState(addStateChangeListener(callback))();
      return () => this.runState(removeStateChangeListener(callback))();
    };

    notifyStateUpdate = (state: ExtensionState): IO.IO<void> =>
      pipe(
        logger.debug("Notifying state change listeners"),
        IO.flatMap(() => this.runState(getStateChangeListeners)),
        IO.map(RS.toReadonlyArray(stateChangeListenerOrd)),
        IO.flatMap(RA.traverse(IO.Applicative)((listener) => IO.of(listener(state)))),
        IO.asUnit,
      );

    render: IO.IO<void> = pipe(
      querySelector("#root")(document),
      IO.flatMap(
        O.match(
          () => logger.error("Root element #root not found"),
          (root) =>
            pipe(
              IO.of(createRoot(root)),
              IO.flatMap((root) =>
                renderSettingsApp(root, {
                  load: this.loadState,
                  save: this.saveState,
                  subscribe: this.subscribe,
                  playChannel: this.playChannel,
                  dispatchKey: this.dispatchKey,
                }),
              ),
            ),
        ),
      ),
    );
  };

const renderSettingsApp = (root: Root, sideEffects: SideEffects): IO.IO<void> =>
  pipe(
    IO.of(
      root.render(
        <StrictMode>
          <Settings sideEffects={sideEffects} />
        </StrictMode>,
      ),
    ),
    IO.flatMap(() => logger.info("Settings app rendered")),
  );
