import { NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime } from "@hbb-emu/player-runtime";
import { useMemo } from "react";

export const usePlayerRuntime = (): PlayerRuntime => {
  const runtime = useMemo(
    () =>
      new PlayerRuntime({
        adapters: {
          native: new NativeAdapter(),
          hls: new NativeAdapter(),
          dash: new NativeAdapter(),
        },
      }),
    [],
  );

  return runtime;
};
