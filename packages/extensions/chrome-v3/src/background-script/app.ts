import { compose } from "@hbb-emu/core";
import { WithMessageBroker } from "@hbb-emu/core/message-bus";
import { WithChromeMessageAdapter, WithChromeScriptInject, WithChromeWebRequestManager } from "@hbb-emu/runtime-chrome";
import { WithAppState } from "./state";

export const App = compose(
  class {},
  WithAppState,
  WithChromeMessageAdapter,
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithMessageBroker("BACKGROUND_SCRIPT"),
);

export type Instance = InstanceType<typeof App>;
