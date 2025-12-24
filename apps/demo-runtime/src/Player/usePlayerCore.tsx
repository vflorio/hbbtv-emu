import { NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerCore } from "@hbb-emu/player-core";
import { useMemo } from "react";

export const usePlayerCore = (): PlayerCore => {
  const playerCore = useMemo(
    () =>
      new PlayerCore({
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
