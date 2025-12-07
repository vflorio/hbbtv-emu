import { Control } from "@hbb-emu/core";
import { AvVideoMp4 } from "@hbb-emu/hbbtv-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { proxyStrategy } from "../attachStrategy";
import type { ElementMatcher } from "../elementMatcher";
import { type OipfObject, toOipfObject } from "../oipfObject";

export const avVideoMp4Matcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "AvVideoMp4",
  selector: `object[type="${Control.VideoMp4.MIME_TYPE}"]`,
  predicate: Control.VideoMp4.isValidElement,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      IO.of(new AvVideoMp4()),
      IO.flatMap((avObject) => proxyStrategy(oipfObject, avObject)),
    ),
};
