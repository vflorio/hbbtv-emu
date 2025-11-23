import { createApplicationManager, createOipfCapabilities, createOipfConfiguration } from "@hbb-emu/hbbtv-api";
import { createVideoBroadcastProxy } from "./videoBroadcastProxy";
import { copyProperties } from "@hbb-emu/lib";

export const attachObjectElement = (element: HTMLObjectElement) => {
  const type = element.getAttribute("type");
  if (!type) return;

  if (type === "video/broadcast") {
    createVideoBroadcastProxy(element);
    return;
  }

  const object = {
    "application/oipfApplicationManager": createApplicationManager(),
    "application/oipfConfiguration": createOipfConfiguration(),
    "application/oipfCapabilities": createOipfCapabilities(),
  }[type];

  if (!object) return;

  copyProperties(object, element);
};
