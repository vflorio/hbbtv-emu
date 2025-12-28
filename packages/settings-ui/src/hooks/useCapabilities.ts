import type { OipfCapabilitiesState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing OIPF Capabilities settings.
 */
export const useCapabilities = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const capabilities = config.hbbtv?.oipfCapabilities ?? {};

  const update = useCallback(
    (newCapabilities: OipfCapabilitiesState) =>
      pipe(
        TE.of({
          ...config,
          hbbtv: {
            ...config.hbbtv,
            oipfCapabilities: newCapabilities,
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
    capabilities,
    update,
  };
};
