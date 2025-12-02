import { type ClassType, DEFAULT_HBBTV_CONFIG, type ExtensionConfig } from "@hbb-emu/lib";
import * as IORef from "fp-ts/IORef";

export interface State {
  stateRef: IORef.IORef<ExtensionConfig.State>;
  tabs: Set<number>;
}

export const WithState = <T extends ClassType>(Base: T) =>
  class extends Base implements State {
    stateRef: IORef.IORef<ExtensionConfig.State> = IORef.newIORef<ExtensionConfig.State>(DEFAULT_HBBTV_CONFIG)();
    tabs: Set<number> = new Set<number>();
  };
