import { compose } from "@hbb-emu/core";
import { WithPostMessageAdapter } from "./postMessageAdapter";
import { WithPostMessageClient } from "./postMessageClient";
import { WithAppState } from "./state";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithPostMessageAdapter,
  WithAppState,
  WithPostMessageClient,
);

export type Instance = InstanceType<typeof App>;
