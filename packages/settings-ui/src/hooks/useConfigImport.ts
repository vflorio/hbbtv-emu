import { DeviceProfileCodec } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";
import type { SettingsState } from "../state";

/**
 * Hook for managing configuration import/export.
 */
export const useConfigImport = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const importConfig = useCallback(
    (importedConfig: SettingsState) =>
      pipe(
        // An export from before device profiles has none: the TV stays the one it is.
        TE.of({
          ...importedConfig,
          device: DeviceProfileCodec.is(importedConfig.device) ? importedConfig.device : config.device,
        }),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO((newConfig) => () => {
          dispatch({ type: "SET_CONFIG", payload: newConfig });
        }),
        TE.map(() => {}),
      ),
    [config.device, dispatch, sideEffects],
  );

  const exportConfig = useCallback(() => {
    return config;
  }, [config]);

  return {
    importConfig,
    exportConfig,
  };
};
