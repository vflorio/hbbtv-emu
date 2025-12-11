import {
  type ChannelConfig,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionState,
  type StreamEventConfig,
} from "@hbb-emu/extension-common";
import { createContext, type Dispatch, type ReactNode, useContext, useEffect, useMemo, useReducer } from "react";

export interface AppState {
  readonly config: ExtensionState;
  readonly isLoading: boolean;
}

const initialState: AppState = {
  config: DEFAULT_HBBTV_CONFIG,
  isLoading: true,
};

export interface SideEffects {
  /** Load initial state from the service */
  load: () => Promise<ExtensionState>;
  /** Save state to the service */
  save: (state: ExtensionState) => Promise<void>;
  /** Subscribe to external state updates (returns unsubscribe function) */
  subscribe: (callback: (state: ExtensionState) => void) => () => void;
  /** Play a channel (side effect) */
  playChannel: (channel: ChannelConfig) => Promise<void>;
}

interface StateContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  sideEffects: SideEffects;
}

const StateContext = createContext<StateContextValue | null>(null);

interface StateProviderProps {
  sideEffects: SideEffects;
  children: ReactNode;
}

export function StateProvider({ sideEffects, children }: StateProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    sideEffects.load().then((config) => {
      dispatch({ type: "SET_CONFIG", payload: config });
    });
  }, [sideEffects]);

  useEffect(() => {
    const unsubscribe = sideEffects.subscribe((config) => {
      dispatch({ type: "SET_CONFIG", payload: config });
    });
    return unsubscribe;
  }, [sideEffects]);

  const value = useMemo(() => ({ state, dispatch, sideEffects }), [state, sideEffects]);

  return <StateContext.Provider value={value}>{children}</StateContext.Provider>;
}

export type Action =
  | Readonly<{ type: "SET_CONFIG"; payload: ExtensionState }>
  | Readonly<{ type: "SET_LOADING"; payload: boolean }>
  | Readonly<{ type: "UPDATE_COMMON"; payload: Omit<ExtensionState, "channels"> }>
  | Readonly<{ type: "UPSERT_CHANNEL"; payload: ChannelConfig }>
  | Readonly<{ type: "REMOVE_CHANNEL"; payload: string }>
  | Readonly<{ type: "SET_CURRENT_CHANNEL"; payload: ChannelConfig | null }>
  | Readonly<{ type: "UPSERT_STREAM_EVENT"; payload: { channelId: string; event: StreamEventConfig } }>
  | Readonly<{ type: "REMOVE_STREAM_EVENT"; payload: { channelId: string; eventId: string } }>;

export const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case "SET_CONFIG":
      return { ...state, config: action.payload, isLoading: false };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "UPDATE_COMMON":
      return {
        ...state,
        config: { ...state.config, ...action.payload },
      };

    case "UPSERT_CHANNEL": {
      const existing = state.config.channels.findIndex((c) => c.id === action.payload.id);
      const channels =
        existing >= 0
          ? state.config.channels.map((c) => (c.id === action.payload.id ? action.payload : c))
          : [...state.config.channels, action.payload];
      return { ...state, config: { ...state.config, channels } };
    }

    case "REMOVE_CHANNEL":
      return {
        ...state,
        config: {
          ...state.config,
          channels: state.config.channels.filter((c) => c.id !== action.payload),
        },
      };

    case "SET_CURRENT_CHANNEL":
      return {
        ...state,
        config: { ...state.config, currentChannel: action.payload },
      };

    case "UPSERT_STREAM_EVENT": {
      const { channelId, event } = action.payload;
      return {
        ...state,
        config: {
          ...state.config,
          channels: state.config.channels.map((c) => {
            if (c.id !== channelId) return c;

            const events = c.streamEvents || [];
            const idx = events.findIndex((e) => e.id === event.id);
            const newEvents = idx >= 0 ? events.map((e) => (e.id === event.id ? event : e)) : [...events, event];

            return { ...c, streamEvents: newEvents };
          }),
        },
      };
    }

    case "REMOVE_STREAM_EVENT": {
      const { channelId, eventId } = action.payload;
      return {
        ...state,
        config: {
          ...state.config,
          channels: state.config.channels.map((c) => {
            if (c.id !== channelId) return c;

            return { ...c, streamEvents: (c.streamEvents || []).filter((e) => e.id !== eventId) };
          }),
        },
      };
    }

    default:
      return state;
  }
};

export const useAppState = (): AppState => {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useAppState must be used within StateProvider");
  return ctx.state;
};

export const useDispatch = (): Dispatch<Action> => {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useDispatch must be used within StateProvider");
  return ctx.dispatch;
};

export const useSideEffects = (): SideEffects => {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useSideEffects must be used within StateProvider");
  return ctx.sideEffects;
};
