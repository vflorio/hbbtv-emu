import type { ClassType } from "@hbb-emu/core";

export type BridgeState = Readonly<{}>;

export type AppState = {};

export const WithAppState = <T extends ClassType>(Base: T) => class extends Base implements AppState {};
