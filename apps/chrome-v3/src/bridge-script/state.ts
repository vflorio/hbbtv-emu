import type { ClassType } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as S from "fp-ts/State";

export type BridgeState = Readonly<{
  tabId: O.Option<number>;
}>;

export interface AppState {
  runState: <A>(stateOp: S.State<BridgeState, A>) => IO.IO<A>;
}

export const WithAppState = <T extends ClassType>(Base: T) =>
  class extends Base implements AppState {
    bridgeState: BridgeState = {
      tabId: O.none,
    };

    getState: IO.IO<BridgeState> = () => this.bridgeState;

    setState =
      (state: BridgeState): IO.IO<void> =>
      () => {
        this.bridgeState = state;
      };

    runState = <A>(stateOp: S.State<BridgeState, A>): IO.IO<A> =>
      pipe(
        this.getState,
        IO.flatMap((currentState) => {
          const [result, nextState] = stateOp(currentState);
          return pipe(
            this.setState(nextState),
            IO.map(() => result),
          );
        }),
      );
  };

export const getTabId: S.State<BridgeState, O.Option<number>> = S.gets((s) => s.tabId);

export const setTabId = (tabId: number): S.State<BridgeState, void> =>
  S.modify((s) => ({ ...s, tabId: O.some(tabId) }));
