import { compose, WithMessageClient } from "@hbb-emu/core";
import { WithPostMessageAdapter } from "../../../../extensions-runtime/web/src";
import { WithAppState } from "./state";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithAppState,
  WithPostMessageAdapter,
  WithMessageClient("CONTENT_SCRIPT"),
 );

export type Instance = InstanceType<typeof App>;
