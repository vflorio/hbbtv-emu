import type { OIPF } from "@hbb-emu/oipf";

export * from "./attach";
export * from "./detection";
export * from "./env";
export * from "./matcher";
export * from "./observer";

export type DetectedElement = Readonly<{
  mimeType: OIPF.DAE.MimeType;
  element: HTMLObjectElement;
}>;
