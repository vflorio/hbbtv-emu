import { isOipfApplicationManager } from "@hbb-emu/core";
import { type OipfObject, toOipfObject } from "@hbb-emu/hbbtv-api";
import type * as IO from "fp-ts/IO";
import type { ElementMatcher } from "../matcher";

export class OipfApplicationManager {}

export const oipfApplicationManagerMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "OipfApplicationManager",
  selector: 'object[type="application/oipfApplicationManager"]',
  predicate: isOipfApplicationManager,
  transform: toOipfObject,
  onDetected:
    (oipf: OipfObject): IO.IO<void> =>
    () => {
      console.log("Detected OIPF Application Manager object:", oipf);
      new OipfApplicationManager();
    },
};
