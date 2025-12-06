import {
  createApplicationManager,
  createOipfCapabilities,
  createOipfConfiguration,
  type OipfObjectType,
} from "@hbb-emu/hbbtv-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Record";
import { copyProperties } from "../../../../../../core/src/lib";
import type { ElementMatcher } from "../elementMatcher";

export interface OipfObject {
  element: HTMLObjectElement;
  type: OipfObjectType;
}

const OIPF_TYPES: OipfObjectType[] = [
  "application/oipfApplicationManager",
  "application/oipfConfiguration",
  "application/oipfCapabilities",
];

const objectFactoryMap: Record<OipfObjectType, () => unknown> = {
  "application/oipfApplicationManager": createApplicationManager,
  "application/oipfConfiguration": createOipfConfiguration,
  "application/oipfCapabilities": createOipfCapabilities,
};

const isOipfObject = (element: Element): element is HTMLObjectElement => {
  if (!(element instanceof HTMLObjectElement)) return false;
  const type = element.getAttribute("type");
  return type !== null && OIPF_TYPES.includes(type as OipfObjectType);
};

const toOipfObject = (element: HTMLObjectElement): OipfObject => ({
  element,
  type: element.getAttribute("type") as OipfObjectType,
});

const handleOipfObject = (oipf: OipfObject): IO.IO<void> =>
  pipe(
    IO.of(R.lookup(oipf.type)(objectFactoryMap)),
    IO.flatMap(
      O.match(
        () => IO.of(undefined),
        (factory) => () => copyProperties(factory() as object, oipf.element),
      ),
    ),
  );

export const oipfObjectMatcher: ElementMatcher<HTMLObjectElement, OipfObject> = {
  name: "OipfObject",
  selector: OIPF_TYPES.map((t) => `object[type="${t}"]`).join(", "),
  predicate: isOipfObject,
  transform: toOipfObject,
  onDetected: handleOipfObject,
};
