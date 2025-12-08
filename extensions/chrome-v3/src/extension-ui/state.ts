import type { ClassType, ExtensionState } from "@hbb-emu/core";
import type * as Eq from "fp-ts/Eq";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import type * as Ord from "fp-ts/Ord";
import * as RS from "fp-ts/ReadonlySet";
import * as S from "fp-ts/State";

export type StateChangeListener = (state: ExtensionState) => void;

/** Referential equality for function comparison */
export const stateChangeListenerEq: Eq.Eq<StateChangeListener> = {
  equals: (a, b) => a === b,
};

export const stateChangeListenerOrd: Ord.Ord<StateChangeListener> = {
  equals: (a, b) => a === b,
  compare: () => 0,
};

export interface AppState {
  config: O.Option<ExtensionState>;
  isLoading: boolean;
  stateChangeListeners: ReadonlySet<StateChangeListener>;
}

export interface AppStateManager {
  getState: IO.IO<AppState>;
  setState: (state: AppState) => IO.IO<void>;
  runState: <A>(op: S.State<AppState, A>) => IO.IO<A>;
}

export const WithAppState = <T extends ClassType>(Base: T) =>
  class extends Base implements AppStateManager {
    isLoading = true;
    config: O.Option<ExtensionState> = O.none;
    stateChangeListeners: ReadonlySet<StateChangeListener> = RS.empty;

    getState: IO.IO<AppState> = () => ({
      config: this.config,
      isLoading: this.isLoading,
      stateChangeListeners: this.stateChangeListeners,
    });

    setState =
      (state: AppState): IO.IO<void> =>
      () => {
        this.config = state.config;
        this.isLoading = state.isLoading;
        this.stateChangeListeners = state.stateChangeListeners;
      };

    runState = <A>(op: S.State<AppState, A>): IO.IO<A> =>
      pipe(
        this.getState,
        IO.flatMap((current) => {
          const [result, next] = op(current);
          return pipe(
            this.setState(next),
            IO.map(() => result),
          );
        }),
      );
  };

export const getConfig: S.State<AppState, O.Option<ExtensionState>> = S.gets((s) => s.config);

export const setConfig = (config: ExtensionState): S.State<AppState, void> =>
  S.modify((s) => ({ ...s, config: O.some(config), isLoading: false }));

export const getIsLoading: S.State<AppState, boolean> = S.gets((s) => s.isLoading);

export const setLoading = (isLoading: boolean): S.State<AppState, void> => S.modify((s) => ({ ...s, isLoading }));

export const getStateChangeListeners: S.State<AppState, ReadonlySet<StateChangeListener>> = S.gets(
  (s) => s.stateChangeListeners,
);

export const addStateChangeListener = (listener: StateChangeListener): S.State<AppState, void> =>
  S.modify((s) => ({
    ...s,
    stateChangeListeners: RS.insert(stateChangeListenerEq)(listener)(s.stateChangeListeners),
  }));

export const removeStateChangeListener = (listener: StateChangeListener): S.State<AppState, void> =>
  S.modify((s) => ({
    ...s,
    stateChangeListeners: RS.remove(stateChangeListenerEq)(listener)(s.stateChangeListeners),
  }));
