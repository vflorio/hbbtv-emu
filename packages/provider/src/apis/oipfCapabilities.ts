import { OIPF } from "@hbb-emu/core";
import { OipfCapabilities } from "@hbb-emu/hbbtv-api";
import * as IO from "fp-ts/IO";
import { pipe } from "fp-ts/lib/function";
import { copyStrategy } from "../attachStrategy";
import type { ElementMatcher } from "../elementMatcher";
import { type OipfObject, toOipfObject } from "../oipfObject";

export const oipfCapabilitiesMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "OipfCapabilities",
  selector: `object[type="${OIPF.Capabilities.MIME_TYPE}"]`,
  predicate: OIPF.Capabilities.isValidElement,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      IO.of(new OipfCapabilities()),
      IO.flatMap((oipfApplicationManager) => copyStrategy(oipfObject, oipfApplicationManager)),
    ),
};
