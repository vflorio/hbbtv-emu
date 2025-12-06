import { isOipfConfiguration } from "@hbb-emu/core";
import { type OipfObject, toOipfObject } from "@hbb-emu/hbbtv-api";
import type * as IO from "fp-ts/IO";
import type { ElementMatcher } from "../matcher";

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
