import { isOipfConfiguration } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";
import type { ElementMatcher } from "../elementMatcher";
import { type OipfObject, toOipfObject } from "../provider";

export class OipfConfiguration {}

export const oipfConfigurationMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "OipfConfiguration",
  selector: 'object[type="application/oipfConfiguration"]',
  predicate: isOipfConfiguration,
  transform: toOipfObject,
  onDetected:
    (oipf: OipfObject): IO.IO<void> =>
    () => {
      console.log("Detected OIPF Application Manager object:", oipf);
      new OipfConfiguration();
    },
};
