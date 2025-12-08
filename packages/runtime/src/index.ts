import { OIPF } from "@hbb-emu/oipf";

export type OipfObject = {
  type: OIPF.DAE.MimeType;
  element: HTMLObjectElement;
};

export const toOipfObject = (element: HTMLObjectElement): OipfObject => ({
  type: OIPF.DAE.applicationManager.MIME_TYPE,
  element,
});

export * from "./provider";
