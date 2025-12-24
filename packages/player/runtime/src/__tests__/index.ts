import { NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerCore } from "@hbb-emu/player-core";

const core = new PlayerCore({
  onDispatch: console.log,
  adapters: {
    native: new NativeAdapter(),
    dash: new NativeAdapter(),
    hls: new NativeAdapter(),
  },
});
