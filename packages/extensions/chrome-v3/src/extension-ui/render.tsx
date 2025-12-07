import {
  type ChannelConfig,
  type ClassType,
  createLogger,
  type ExtensionState,
  notImplementedError,
  querySelector,
} from "@hbb-emu/core";
import { Settings } from "@hbb-emu/settings-ui";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RS from "fp-ts/ReadonlySet";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  type AppStateManager,
  addStateChangeListener,
  getStateChangeListeners,
  removeStateChangeListener,
  type StateChangeListener,
  stateChangeListenerOrd,
} from "./state";

const logger = createLogger("SidePanel");

export interface Render {
  render: IO.IO<void>;
  notifyStateUpdate: (state: ExtensionState) => IO.IO<void>;
}

export const WithRender = <T extends ClassType<AppStateManager>>(Base: T) =>
  class extends Base implements Render {
    loadState = async (): Promise<ExtensionState> => {
      throw notImplementedError("loadState not implemented");
    };

    saveState = async (_state: ExtensionState): Promise<void> => {
      throw notImplementedError("saveState not implemented");
    };

    playChannel = async (_channel: ChannelConfig): Promise<void> => {
      throw notImplementedError("playChannel not implemented");
    };

    subscribe = (callback: StateChangeListener): (() => void) => {
      this.runState(addStateChangeListener(callback))();
      return () => {
        this.runState(removeStateChangeListener(callback))();
      };
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
      logger.info("Initializing React app"),
      IO.flatMap(() => querySelector("#root")(document)),
      IO.flatMap(
        O.match(
          () => logger.error("Root element #root not found"),
          (rootElement) =>
            pipe(
              IO.of(createRoot(rootElement as HTMLElement)),
              IO.tap((root) =>
                IO.of(
                  root.render(
                    <StrictMode>
                      <Settings
                        sideEffects={{
                          load: this.loadState,
                          save: this.saveState,
                          subscribe: this.subscribe,
                          playChannel: this.playChannel,
                        }}
                      />
                    </StrictMode>,
                  ),
                ),
              ),
              IO.flatMap(() => logger.info("React app rendered")),
            ),
        ),
      ),
    );
  };
