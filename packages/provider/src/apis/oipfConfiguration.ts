import { OIPF } from "@hbb-emu/core";
import { OipfConfiguration } from "@hbb-emu/hbbtv-api";
import * as IO from "fp-ts/IO";
import { pipe } from "fp-ts/lib/function";
import { type OipfObject, toOipfObject } from "..";
import { copyStrategy } from "../attachStrategy";
import type { ElementMatcher } from "../elementMatcher";

export const oipfConfigurationMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "OipfConfiguration",
  selector: `object[type="${OIPF.Configuration.MIME_TYPE}"]`,
  predicate: OIPF.Configuration.isValidElement,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      IO.of(new OipfConfiguration()),
      IO.flatMap((oipfApplicationManager) => copyStrategy(oipfObject, oipfApplicationManager)),
    ),
};
