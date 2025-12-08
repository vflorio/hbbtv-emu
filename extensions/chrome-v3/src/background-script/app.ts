import { compose } from "@hbb-emu/core";
import { WithMessageBroker } from "@hbb-emu/core/message-bus";
import {
  WithChromeMessageAdapter,
  WithChromeScriptInject,
  WithChromeWebRequestManager,
} from "../../../../extensions-runtime/chrome/src";
import { WithAppState } from "./state";

export const App = compose(
  class {},
  WithAppState,
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithChromeMessageAdapter,
  WithMessageBroker("BACKGROUND_SCRIPT"),
);

export type Instance = InstanceType<typeof App>;
