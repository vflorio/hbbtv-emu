import { compose } from "@hbb-emu/core";
import { WithMessageClient } from "@hbb-emu/core/message-bus";
import { WithPostMessageAdapter } from "@hbb-emu/web-runtime";
import { WithAppState } from "./state";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithAppState,
  WithPostMessageAdapter,
  WithMessageClient("CONTENT_SCRIPT"),
);

export type Instance = InstanceType<typeof App>;
