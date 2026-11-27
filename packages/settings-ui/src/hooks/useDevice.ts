import type { DeviceProfile } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * The TV the emulator is (its device profile), and the User-Agent header it sends,
 * which the background gives from it.
 */
export const useDevice = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const update = useCallback(
    (device: DeviceProfile) =>
      pipe(
        TE.of({ ...config, device }),
        TE.tap((updated) => sideEffects.save(updated)),
        TE.tapIO((updated) => () => {
          dispatch({ type: "SET_CONFIG", payload: updated });
        }),
        TE.map(() => {}),
      ),
    [config, dispatch, sideEffects],
  );

  return {
    device: config.device,
    userAgent: config.userAgent,
    update,
  };
};
