import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing User Agent settings.
 * Provides read-only access to user agent state and actions to update it.
 */
export const useUserAgent = () => {
  const { config } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const userAgent = config.userAgent;

  const update = useCallback(
    (userAgent: string) =>
      pipe(
        TE.of({
          ...config,
          userAgent,
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
    userAgent,
    update,
  };
};
