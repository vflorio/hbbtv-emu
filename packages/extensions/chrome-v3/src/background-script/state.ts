import { type ClassType, DEFAULT_HBBTV_CONFIG, type ExtensionConfig } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as N from "fp-ts/number";
import * as RS from "fp-ts/ReadonlySet";
import * as S from "fp-ts/State";

export interface AppState {
  tabs: ReadonlySet<number>;
  config: ExtensionConfig.State;
}

export const getConfig: S.State<AppState, ExtensionConfig.State> = S.gets((s) => s.config);

export const setConfig = (config: ExtensionConfig.State): S.State<AppState, void> =>
  S.modify((s) => ({ ...s, config }));

export const getTabs: S.State<AppState, ReadonlySet<number>> = S.gets((s) => s.tabs);

export const addTab = (tabId: number): S.State<AppState, void> =>
  S.modify((s) => ({ ...s, tabs: RS.insert(N.Eq)(tabId)(s.tabs) }));

export const removeTab = (tabId: number): S.State<AppState, void> =>
  S.modify((s) => ({ ...s, tabs: RS.remove(N.Eq)(tabId)(s.tabs) }));

export const WithAppState = <T extends ClassType>(Base: T) =>
  class extends Base {
    // Exposed for WithChromeWebRequestManager
    tabs: ReadonlySet<number> = RS.empty;
    config: ExtensionConfig.State = DEFAULT_HBBTV_CONFIG;

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
