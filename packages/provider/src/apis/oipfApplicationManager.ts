import { OIPF } from "@hbb-emu/core";
import { OipfApplicationManager } from "@hbb-emu/hbbtv-api";
import * as IO from "fp-ts/IO";
import { pipe } from "fp-ts/lib/function";
import { copyStrategy } from "../attachStrategy";
import type { ElementMatcher } from "../elementMatcher";
import { type OipfObject, toOipfObject } from "../oipfObject";

export const oipfApplicationManagerMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "OipfApplicationManager",
  selector: `object[type="${OIPF.ApplicationManager.MIME_TYPE}"]`,
  predicate: OIPF.ApplicationManager.isValidElement,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      IO.of(new OipfApplicationManager()),
      IO.flatMap((oipfApplicationManager) => copyStrategy(oipfObject, oipfApplicationManager)),
    ),
};
