import { isOipfConfiguration } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";
import type { ElementMatcher } from "../elementMatcher";
import { type OipfObject, toOipfObject } from "../provider";

export class OipfCapabilities {}

export const oipfCapabilitiesMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "OipfCapabilities",
  selector: 'object[type="application/oipfCapabilities"]',
  predicate: isOipfConfiguration,
  transform: toOipfObject,
  onDetected:
    (oipf: OipfObject): IO.IO<void> =>
    () => {
      console.log("Detected OIPF Application Manager object:", oipf);
      new OipfCapabilities();
    },
};
