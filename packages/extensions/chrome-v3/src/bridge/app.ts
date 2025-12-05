import { compose } from "@hbb-emu/core";
import { WithBridgeForwarder } from "./forwarder";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithBridgeForwarder,
);

export type Instance = InstanceType<typeof App>;
