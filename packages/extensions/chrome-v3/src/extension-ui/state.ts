import type { ClassType, ExtensionConfig } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as S from "fp-ts/State";

export interface AppState {
  config: O.Option<State>;
  isLoading: boolean;
}

export const WithAppState = <T extends ClassType>(Base: T) =>
  class extends Base {
    config: O.Option<State> = O.none;
    isLoading = true;

    // Callback for React re-render
    onConfigUpdate?: (config: State) => void;

    getState: IO.IO<AppState> = () => ({
      config: this.config,
      isLoading: this.isLoading,
    });

    setState =
      (state: AppState): IO.IO<void> =>
      () => {
        this.config = state.config;
        this.isLoading = state.isLoading;
      };

    runState = <A>(op: S.State<AppState, A>): IO.IO<A> =>
      pipe(
        this.getState,
        IO.flatMap((current) => {
          const [result, next] = op(current);
          return pipe(
            this.setState(next),
            IO.tap(() => () => {
              // Trigger React callback if config changed
              if (O.isSome(next.config)) {
                this.onConfigUpdate?.(next.config.value);
              }
            }),
            IO.map(() => result),
          );
        }),
      );
  };

export const getConfig: S.State<AppState, O.Option<State>> = S.gets((s) => s.config);

export const setConfig = (config: State): S.State<AppState, void> =>
  S.modify((s) => ({ ...s, config: O.some(config), isLoading: false }));

export const getIsLoading: S.State<AppState, boolean> = S.gets((s) => s.isLoading);

export const setLoading = (isLoading: boolean): S.State<AppState, void> => S.modify((s) => ({ ...s, isLoading }));
