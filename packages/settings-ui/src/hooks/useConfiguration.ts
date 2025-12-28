import type { OipfConfigurationState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing OIPF Configuration settings.
 */
export const useConfiguration = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const configuration = config.hbbtv?.oipfConfiguration ?? {};

  const update = useCallback(
    (newConfiguration: OipfConfigurationState) =>
      pipe(
        TE.of({
          ...config,
          hbbtv: {
            ...config.hbbtv,
            oipfConfiguration: newConfiguration,
          },
        }),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO((newConfig) => () => {
          dispatch({ type: "SET_CONFIG", payload: newConfig });
        }),
        TE.map(() => {}),
      ),
    [config, dispatch, sideEffects],
  );

  return {
    configuration,
    update,
  };
};
