import type { OIPF } from "@hbb-emu/core";

export interface OipfObject {
  element: HTMLObjectElement;
  type: OIPF.ObjectFactory.DAEMimeType;
}

export const toOipfObject = (element: HTMLObjectElement) => ({
  element,
  type: element.getAttribute("type") as OIPF.ObjectFactory.DAEMimeType,
});
