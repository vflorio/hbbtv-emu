import type { ExtensionState } from "@hbb-emu/core";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/state";

export const useCommonActions = () => {
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();
  const { config } = useAppState();

  const save = useCallback(
    async (common: Omit<ExtensionState, "channels">) => {
      dispatch({ type: "UPDATE_COMMON", payload: common });

      await sideEffects.save({ ...common, channels: config.channels });
    },
    [dispatch, sideEffects, config],
  );

  return { save };
};
