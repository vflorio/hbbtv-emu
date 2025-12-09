import { type ApplicationManagerState, OIPF } from "@hbb-emu/oipf";
import type { ObjectDefinition } from "../../objectDefinitions";
import { OipfApplicationManager } from "./applicationManager";

export * from "./application";
export * from "./applicationManager";
export * from "./keyset";

export const oipfApplicationManagerDefinition: ObjectDefinition<
  OipfApplicationManager,
  ApplicationManagerState,
  "applicationManager"
> = {
  name: "OipfApplicationManager",
  selector: `object[type="${OIPF.DAE.ApplicationManager.MIME_TYPE}"]`,
  predicate: OIPF.DAE.ApplicationManager.isValidElement,
  factory: () => new OipfApplicationManager(),
  stateKey: "applicationManager",
  attachStrategy: "copy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};
