import type { ExtensionState } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing Player UI settings.
 */
export const usePlayerUi = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const playerUiVisible = config.playerUiVisible;

  const setVisible = useCallback(
    (visible: boolean) =>
      pipe(
        TE.of<unknown, ExtensionState>({
          ...config,
          playerUiVisible: visible,
        }),
        TE.tap((updated) => sideEffects.save(updated)),
        TE.tapIO((updated) => () => {
          dispatch({ type: "SET_CONFIG", payload: updated });
        }),
        TE.map(() => {}),
      ),
    [config, dispatch, sideEffects],
  );

  return {
    playerUiVisible,
    setVisible,
  };
};
