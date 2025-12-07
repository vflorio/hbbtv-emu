import type { ChannelConfig } from "@hbb-emu/core";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/state";

export const useChannelActions = () => {
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();
  const { config } = useAppState();

  const upsert = useCallback(
    async (channel: ChannelConfig) => {
      dispatch({ type: "UPSERT_CHANNEL", payload: channel });

      const existing = config.channels.findIndex((c) => c.id === channel.id);
      const channels =
        existing >= 0 ? config.channels.map((c) => (c.id === channel.id ? channel : c)) : [...config.channels, channel];

      await sideEffects.save({ ...config, channels });
    },
    [dispatch, sideEffects, config],
  );

  const remove = useCallback(
    async (id: string) => {
      dispatch({ type: "REMOVE_CHANNEL", payload: id });
      const channels = config.channels.filter((c) => c.id !== id);

      await sideEffects.save({ ...config, channels });
    },
    [dispatch, sideEffects, config],
  );

  const play = useCallback(
    async (channel: ChannelConfig) => {
      await sideEffects.playChannel(channel);
    },
    [sideEffects],
  );

  return { upsert, remove, play };
};
