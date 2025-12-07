import { OIPF } from "@hbb-emu/core";
import { OipfCapabilities } from "@hbb-emu/hbbtv-api";
import * as IO from "fp-ts/IO";
import { pipe } from "fp-ts/lib/function";
import { type OipfObject, toOipfObject } from "..";
import { copyStrategy } from "../attachStrategy";
import type { ElementMatcher } from "../elementMatcher";
import type { StateManager } from "../stateManager";

/**
 * Create an OipfCapabilities matcher bound to a StateManager instance.
 * This allows the matcher to register instances with the app's state manager.
 */
export const createOipfCapabilitiesMatcher = (
  stateManager: StateManager,
): ElementMatcher<HTMLObjectElement, OipfObject> => ({
  name: "OipfCapabilities",
  selector: `object[type="${OIPF.Capabilities.MIME_TYPE}"]`,
  predicate: OIPF.Capabilities.isValidElement,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      IO.of(new OipfCapabilities()),
      IO.tap((instance) => stateManager.registerCapabilities(instance)),
      IO.flatMap((instance) => copyStrategy(oipfObject, instance)),
    ),
});
