import { compose } from "@hbb-emu/core";
import { WithMessageClient } from "@hbb-emu/core/message-bus";
import { WithChromeMessageAdapter } from "@hbb-emu/runtime-chrome";
import { WithAppState } from "./state";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithAppState,
  WithChromeMessageAdapter,
  WithMessageClient("SIDE_PANEL"),
);

export type Instance = InstanceType<typeof App>;
