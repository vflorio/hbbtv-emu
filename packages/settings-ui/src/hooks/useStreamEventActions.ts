import type { StreamEventConfig } from "@hbb-emu/extension-common";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/state";

export const useStreamEventActions = (channelId: string) => {
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();
  const { config } = useAppState();

  const upsert = useCallback(
    async (event: StreamEventConfig) => {
      dispatch({ type: "UPSERT_STREAM_EVENT", payload: { channelId, event } });

      const channels = config.channels.map((c) => {
        if (c.id !== channelId) return c;

        const events = c.streamEvents || [];
        const idx = events.findIndex((e) => e.id === event.id);
        const newEvents = idx >= 0 ? events.map((e) => (e.id === event.id ? event : e)) : [...events, event];

        return { ...c, streamEvents: newEvents };
      });

      await sideEffects.save({ ...config, channels });
    },
    [dispatch, sideEffects, config, channelId],
  );

  const remove = useCallback(
    async (eventId: string) => {
      dispatch({ type: "REMOVE_STREAM_EVENT", payload: { channelId, eventId } });

      const channels = config.channels.map((c) => {
        if (c.id !== channelId) return c;

        return { ...c, streamEvents: (c.streamEvents || []).filter((e) => e.id !== eventId) };
      });

      await sideEffects.save({ ...config, channels });
    },
    [dispatch, sideEffects, config, channelId],
  );

  return { upsert, remove };
};
