import { DASHAdapter, HLSAdapter, NativeAdapter } from "@functional-player/player-adapter-web";
import { PlayerRuntime } from "@functional-player/player-runtime";
import { useMemo } from "react";

export const usePlayerRuntime = (): PlayerRuntime => {
  const runtime = useMemo(
    () =>
      new PlayerRuntime({
        adapters: {
          native: new NativeAdapter(),
          hls: new HLSAdapter(),
          dash: new DASHAdapter(),
        },
      }),
    [],
  );

  return runtime;
};
