import type { ChannelConfig } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

/**
 * Hook for managing channel actions: upsert, remove, play on the active TV, turn on a new TV.
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

  /** The background answers with the new state (the active tab's channel), like any change. */
  const play = useCallback((channel: ChannelConfig) => sideEffects.playChannel(channel), [sideEffects]);

  const turnOnTv = useCallback((channel: ChannelConfig) => sideEffects.turnOnTv(channel.id), [sideEffects]);

  return { upsert, remove, play, turnOnTv };
};
