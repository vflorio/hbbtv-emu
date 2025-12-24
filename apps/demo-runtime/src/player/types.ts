import type { PlayerEvent, PlayerState } from "@hbb-emu/player";
import type { ReactNode } from "react";

export type RuntimeDebugEntry =
  | {
      readonly id: number;
      readonly kind: "intent" | "engine" | "error";
      readonly time: number;
      readonly event: PlayerEvent;
    }
  | {
      readonly id: number;
      readonly kind: "state";
      readonly time: number;
      readonly from: string;
      readonly to: string;
    };

export type PlaybackContextType = {
  playbackType: string | null;
  playerState: PlayerState.Any | null;
  videoElement: HTMLVideoElement | null;
  error: string | null;
  isLoading: boolean;
  loadSource: (source: string) => void;
  dispatch: (event: PlayerEvent) => void;
  transitions: readonly RuntimeDebugEntry[];
  renderVideoElement: () => ReactNode;
};
