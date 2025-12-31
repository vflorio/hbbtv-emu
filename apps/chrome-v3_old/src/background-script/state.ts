import type { ClassType } from "@hbb-emu/core";
import { DEFAULT_EXTENSION_STATE, type ExtensionState } from "@hbb-emu/extension-common";
import type { WebRequestManager } from "@hbb-emu/runtime-chrome";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as N from "fp-ts/number";
import * as RS from "fp-ts/ReadonlySet";
import * as S from "fp-ts/State";

export interface AppState {
  tabs: ReadonlySet<number>;
  config: ExtensionState;
}

export const WithAppState = <T extends ClassType>(Base: T) =>
  class extends Base implements AppState, WebRequestManager {
    tabs: ReadonlySet<number> = RS.empty;
    config: ExtensionState = DEFAULT_EXTENSION_STATE;

    onTabAdded = (tabId: number): IO.IO<void> => this.runState(addTab(tabId));

    onTabRemoved = (tabId: number): IO.IO<void> => this.runState(removeTab(tabId));

    getState: IO.IO<AppState> = () => ({
      tabs: this.tabs,
      config: this.config,
    });

    setState =
      (state: AppState): IO.IO<void> =>
      () => {
        this.tabs = state.tabs;
        this.config = state.config;
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

export const getConfig: S.State<AppState, ExtensionState> = S.gets((s) => s.config);

export const setConfig = (config: ExtensionState): S.State<AppState, void> => S.modify((s) => ({ ...s, config }));

export const getTabs: S.State<AppState, ReadonlySet<number>> = S.gets((s) => s.tabs);

export const addTab = (tabId: number): S.State<AppState, void> =>
  S.modify((s) => ({ ...s, tabs: RS.insert(N.Eq)(tabId)(s.tabs) }));

export const removeTab = (tabId: number): S.State<AppState, void> =>
  S.modify((s) => ({ ...s, tabs: RS.remove(N.Eq)(tabId)(s.tabs) }));
