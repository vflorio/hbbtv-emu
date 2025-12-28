import type { StreamEventConfig } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useCallback } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/AppState";

export const useStreamEventActions = (channelId: string) => {
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();
  const { config } = useAppState();

  const upsert = useCallback(
    (event: StreamEventConfig) => {
      const channels = config.channels.map((channel) => {
        if (channel.id !== channelId) return channel;

        const events = channel.streamEvents || [];
        const idx = events.findIndex((e) => e.id === event.id);
        const newEvents = idx >= 0 ? events.map((e) => (e.id === event.id ? event : e)) : [...events, event];

        return { ...channel, streamEvents: newEvents };
      });

      return pipe(
        TE.of({ ...config, channels }),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO(() => () => {
          dispatch({ type: "UPSERT_STREAM_EVENT", payload: { channelId, event } });
        }),
      );
    },
    [dispatch, sideEffects, config, channelId],
  );

  const remove = useCallback(
    (eventId: string) => {
      const channels = config.channels.map((channel) => {
        if (channel.id !== channelId) return channel;

        return { ...channel, streamEvents: (channel.streamEvents || []).filter((e) => e.id !== eventId) };
      });

      return pipe(
        TE.of({ ...config, channels }),
        TE.tap((newConfig) => sideEffects.save(newConfig)),
        TE.tapIO(() => () => {
          dispatch({ type: "REMOVE_STREAM_EVENT", payload: { channelId, eventId } });
        }),
      );
    },
    [dispatch, sideEffects, config, channelId],
  );

  return { upsert, remove };
};
