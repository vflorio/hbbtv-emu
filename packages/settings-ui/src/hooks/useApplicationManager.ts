import type { ApplicationManagerState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing Application Manager settings.
 */
export const useApplicationManager = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const applicationManager = config.hbbtv?.applicationManager ?? {};

  const update = useCallback(
    (newAppManager: ApplicationManagerState) =>
      pipe(
        TE.of({
          ...config,
          hbbtv: {
            ...config.hbbtv,
            applicationManager: newAppManager,
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
    applicationManager,
    update,
  };
};
