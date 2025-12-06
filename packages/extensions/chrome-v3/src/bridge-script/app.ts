import { compose } from "@hbb-emu/core";
import { WithBridgeForwarder } from "./forwarder";
import { WithAppState } from "./state";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithAppState,
  WithBridgeForwarder,
);

export type Instance = InstanceType<typeof App>;
