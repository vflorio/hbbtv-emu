import type { VideoBroadcastState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import type { ExtensionState } from "node_modules/@hbb-emu/extension-common/dist/extension";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing Video Broadcast settings.
 */
export const useVideoBroadcast = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const videoBroadcast = config.hbbtv?.videoBroadcast ?? {};

  const update = useCallback<(next: VideoBroadcastState) => TE.TaskEither<unknown, ExtensionState>>(
    (next) =>
      pipe(
        TE.of({
          ...config,
          hbbtv: {
            ...config.hbbtv,
            videoBroadcast: next,
          },
        }),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO((newConfig) => () => {
          dispatch({ type: "SET_CONFIG", payload: newConfig });
        }),
      ),
    [config, dispatch, sideEffects],
  );

  return {
    videoBroadcast,
    update,
  };
};
