import { compose } from "@hbb-emu/core";
import { WithBridgeClient } from "./bridgeClient";
import { WithChromeToPostMessageBridge } from "./chromeAdapter";
import { WithPostMessageAdapter } from "./postMessageAdapter";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithPostMessageAdapter,
  WithChromeToPostMessageBridge,
  WithBridgeClient,
);

export type Instance = InstanceType<typeof App>;
