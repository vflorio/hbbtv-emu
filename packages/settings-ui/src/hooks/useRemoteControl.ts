import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useSideEffects } from "../context/AppState";

/**
 * Hook for managing Remote Control key dispatching.
 */
export const useRemoteControl = () => {
  const sideEffects = useSideEffects();

  const dispatchKey = useCallback(
    (keyCode: number) =>
      pipe(
        sideEffects.dispatchKey(keyCode),
        TE.match(
          (error) => {
            console.error("[useRemoteControl] Failed to dispatch key:", error);
          },
          () => {
            console.log(`[useRemoteControl] Key ${keyCode} dispatched successfully`);
          },
        ),
      ),
    [sideEffects],
  );

  return {
    dispatchKey,
  };
};
