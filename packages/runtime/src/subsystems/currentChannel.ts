/**
 * Current Channel Provider
 *
 * Provides a shared state for the current broadcast channel.
 * Used by VideoBroadcast to publish channel changes and by
 * ApplicationPrivateData to read the current channel.
 */

import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";

const logger = createLogger("CurrentChannelProvider");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listener for channel change events.
 */
export type OnChannelChangeListener = (channel: OIPF.DAE.Broadcast.Channel | null) => void;

/**
 * Environment for getting and setting the current channel.
 */
export type CurrentChannelEnv = Readonly<{
  /** Gets the current channel */
  getCurrentChannel: () => OIPF.DAE.Broadcast.Channel | null;
  /** Sets the current channel */
  setCurrentChannel: (channel: OIPF.DAE.Broadcast.Channel | null) => void;
  /** Subscribes to channel changes */
  subscribe: (listener: OnChannelChangeListener) => () => void;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a current channel provider.
 *
 * This provides a simple shared state for the current channel that can be
 * read by ApplicationPrivateData and written by VideoBroadcast.
 *
 * @returns CurrentChannelEnv
 */
export const createCurrentChannelEnv = (): CurrentChannelEnv => {
  let currentChannel: OIPF.DAE.Broadcast.Channel | null = null;
  const listeners = new Set<OnChannelChangeListener>();

  const getCurrentChannel = (): OIPF.DAE.Broadcast.Channel | null => {
    logger.debug("getCurrentChannel:", currentChannel)();
    return currentChannel;
  };

  const setCurrentChannel = (channel: OIPF.DAE.Broadcast.Channel | null): void => {
    if (currentChannel !== channel) {
      logger.debug("setCurrentChannel:", channel)();
      currentChannel = channel;
      // Notify all listeners
      for (const listener of listeners) {
        listener(channel);
      }
    }
  };

  const subscribe = (listener: OnChannelChangeListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getCurrentChannel,
    setCurrentChannel,
    subscribe,
  };
};
