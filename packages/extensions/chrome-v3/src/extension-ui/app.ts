import { compose } from "@hbb-emu/core";
import { WithMessageClient } from "@hbb-emu/core/message-bus";
import { WithChromeMessageAdapter } from "@hbb-emu/runtime-chrome";
import { WithBridge } from "./bridge";
import { WithRender } from "./render";
import { WithAppState } from "./state";

export const App = compose(
  class {},
  WithChromeMessageAdapter,
  WithMessageClient("SIDE_PANEL"),
  WithAppState,
  WithRender,
  WithBridge,
);

export type Instance = InstanceType<typeof App>;
