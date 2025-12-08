import { OIPF } from "@hbb-emu/core";

export type OipfObject = {
  type: OIPF.ObjectFactory.DAEMimeType;
  element: HTMLObjectElement;
};

export const toOipfObject = (element: HTMLObjectElement): OipfObject => ({
  type: OIPF.ApplicationManager.MIME_TYPE,
  element,
});

export * from "./provider";
