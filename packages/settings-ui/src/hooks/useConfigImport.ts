import type { ExtensionState } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing configuration import/export.
 */
export const useConfigImport = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const importConfig = useCallback(
    (importedConfig: ExtensionState) =>
      pipe(
        TE.of(importedConfig),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO((newConfig) => () => {
          dispatch({ type: "SET_CONFIG", payload: newConfig });
        }),
        TE.map(() => {}),
      ),
    [dispatch, sideEffects],
  );

  const exportConfig = useCallback(() => {
    return config;
  }, [config]);

  return {
    importConfig,
    exportConfig,
  };
};
