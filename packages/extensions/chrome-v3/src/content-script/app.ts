import { compose, WithMessageClient } from "@hbb-emu/core";
import { WithPostMessageAdapter } from "@hbb-emu/runtime-web";
import { WithAppState } from "./state";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithAppState,
  WithPostMessageAdapter,
  WithMessageClient("CONTENT_SCRIPT"),
 );

export type Instance = InstanceType<typeof App>;
