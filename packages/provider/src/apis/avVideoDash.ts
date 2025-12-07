import { Control } from "@hbb-emu/core";
import { AvVideoDash } from "@hbb-emu/hbbtv-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { proxyStrategy } from "../attachStrategy";
import type { ElementMatcher } from "../elementMatcher";
import { type OipfObject, toOipfObject } from "../oipfObject";

export const avVideoDashMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "AvVideoDash",
  selector: `object[type="${Control.VideoDash.MIME_TYPE}"]`,
  predicate: Control.VideoDash.isValidElement,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      IO.of(new AvVideoDash()),
      IO.flatMap((avObject) => proxyStrategy(oipfObject, avObject)),
    ),
};
