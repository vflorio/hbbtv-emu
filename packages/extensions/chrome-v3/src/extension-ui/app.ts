import { compose } from "@hbb-emu/core";
import { WithMessageClient } from "@hbb-emu/core/message-bus";
import { WithChromeMessageAdapter } from "@hbb-emu/runtime-chrome";
import { WithRender } from "./render";
import { WithAppState } from "./state";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithAppState,
  WithChromeMessageAdapter,
  WithMessageClient("SIDE_PANEL"),
  WithRender,
);

export type Instance = InstanceType<typeof App>;
