import { Broadcast } from "@hbb-emu/core";
import { AvVideoBroadcast } from "@hbb-emu/hbbtv-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { proxyStrategy } from "../attachStrategy";
import type { ElementMatcher } from "../elementMatcher";
import { type OipfObject, toOipfObject } from "../oipfObject";

export const avVideoBroadcastMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "AvVideoBroadcast",
  selector: `object[type="${Broadcast.videoBroadcast.MIME_TYPE}"]`,
  predicate: Broadcast.videoBroadcast.isValidElement,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      IO.of(new AvVideoBroadcast()),
      IO.flatMap((avObject) => proxyStrategy(oipfObject, avObject)),
    ),
};
