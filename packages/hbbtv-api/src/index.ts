import { WithMessageBus } from "@hbb-emu/lib";

export { createApplicationManager } from "./applicationManager";
export { createOipfCapabilities } from "./capabilities";
export { createOipfConfiguration } from "./configuration";
export { createObjectFactory } from "./objectFactory";
export { createOipf } from "./oipf";
export { VideoBroadcastObject } from "./videoBroadcastObject";

export const WithContentScriptMessageBus = WithMessageBus("CONTENT_SCRIPT");
