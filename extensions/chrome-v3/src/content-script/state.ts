import type { ClassType } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as S from "fp-ts/State";

export interface AppState {
  config: O.Option<ExtensionState>;
  isReady: boolean;
}

export const WithAppState = <T extends ClassType>(Base: T) =>
  class extends Base {
    config: O.Option<ExtensionState> = O.none;
    isReady = false;

    getState: IO.IO<AppState> = () => ({
      config: this.config,
      isReady: this.isReady,
    });

    setState =
      (state: AppState): IO.IO<void> =>
      () => {
        this.config = state.config;
        this.isReady = state.isReady;
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
  S.modify((s) => ({ ...s, config: O.some(config) }));

export const getIsReady: S.State<AppState, boolean> = S.gets((s) => s.isReady);

export const setReady: S.State<AppState, void> = S.modify((s) => ({ ...s, isReady: true }));
