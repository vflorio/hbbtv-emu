import type { DeviceCapabilities } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * The TV's capabilities: the device's, which every page's Capabilities object reports.
 */
export const useCapabilities = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const capabilities = config.device.capabilities;

  const update = useCallback(
    (next: DeviceCapabilities) =>
      pipe(
        TE.of({ ...config, device: { ...config.device, capabilities: next } }),
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
