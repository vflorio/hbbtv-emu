import type * as IO from "fp-ts/IO";
import { isOipfApplicationManager } from "../../../core/dist/hbbtv/validate";
import type { ElementMatcher } from "../elementMatcher";
import { type OipfObject, toOipfObject } from "../provider";

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
