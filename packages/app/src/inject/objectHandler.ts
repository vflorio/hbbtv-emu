import { createApplicationManager, createOipfCapabilities, createOipfConfiguration } from "@hbb-emu/hbbtv-api";
import { createVideoBroadcastProxy } from "./videoBroadcastProxy";

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

const copyProperties = (source: object, target: HTMLObjectElement) => {
  Object.keys(source).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor) Object.defineProperty(target, key, descriptor);
  });

  const proto = Object.getPrototypeOf(source);
  if (!proto) return;

  Object.getOwnPropertyNames(proto).forEach((key) => {
    if (key !== "constructor" && !(key in target)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor) Object.defineProperty(target, key, descriptor);
    }
  });
};
