import type { ChannelConfig } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing channel actions such as upsert, remove, and play.
 */
export const useChannelActions = () => {
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();
  const { config } = useAppState();

  const upsert = useCallback(
    (channel: ChannelConfig) => {
      const existing = config.channels.findIndex((c) => c.id === channel.id);
      const channels =
        existing >= 0 ? config.channels.map((c) => (c.id === channel.id ? channel : c)) : [...config.channels, channel];

      return pipe(
        TE.of({ ...config, channels }),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO(() => () => {
          dispatch({ type: "UPSERT_CHANNEL", payload: channel });
        }),
        TE.asUnit,
      );
    },
    [dispatch, sideEffects, config],
  );

  const remove = useCallback(
    (id: string) => {
      const channels = config.channels.filter((c) => c.id !== id);

      return pipe(
        TE.of({ ...config, channels }),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO(() => () => {
          dispatch({ type: "REMOVE_CHANNEL", payload: id });
        }),
        TE.asUnit,
      );
    },
    [dispatch, sideEffects, config],
  );

  const play = useCallback(
    (channel: ChannelConfig) =>
      pipe(
        TE.of({ ...config, currentChannel: channel }),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO(() => () => {
          dispatch({ type: "SET_CURRENT_CHANNEL", payload: channel });
        }),
        TE.tap(() => sideEffects.playChannel(channel)),
        TE.asUnit,
      ),
    [sideEffects, dispatch, config],
  );

  return { upsert, remove, play };
};
