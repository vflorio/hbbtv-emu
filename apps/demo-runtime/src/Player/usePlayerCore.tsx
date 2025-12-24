import { NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerCore, type PlayerEvent } from "@hbb-emu/player-core";
import { useMemo } from "react";

export const usePlayerCore = (options: { readonly onDispatch?: (event: PlayerEvent) => void }): PlayerCore => {
  const playerCore = useMemo(
    () =>
      new PlayerCore({
        onDispatch: options.onDispatch,
        adapters: {
          native: new NativeAdapter(),
          hls: new NativeAdapter(),
          dash: new NativeAdapter(),
        },
      }),
    [],
  );

  return playerCore;
};
